"""MusicXML → Sparks NMN (.spnmn) 格式转换器核心逻辑。"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

from music21 import (
    chord,
    converter as m21converter,
    key as m21key,
    meter,
    note,
    stream,
)

from app.modes.musicxml.metadata import (
    build_header,
    extract_composer,
    extract_key,
    extract_tempo,
    extract_time_signature,
    extract_title,
)
from app.modes.musicxml.pitch_utils import (
    build_scale_pc_map,
    format_note_token,
    resolve_tonic_octave,
)
from app.modes.musicxml.rhythm_utils import (
    deduplicate_by_offset,
    expand_to_beat_tokens,
    group_sub_beat_tokens,
)


def convert_musicxml_to_spnmn(
    file_path: str | Path,
    part_index: int = 0,
) -> dict:
    """将 MusicXML 文件转换为 Sparks NMN (.spnmn) 文本。

    Args:
        file_path: MusicXML 文件路径。
        part_index: 声部索引，默认取第一声部。

    Returns:
        {
            "spnmn_text": str,       # 完整的 .spnmn 文本
            "key_name": str,         # 调号显示名
            "time_signature": str,   # 拍号
            "total_measures": int,   # 小节数
            "part_name": str,        # 声部名
            "num_parts": int,        # 总声部数
            "warnings": list[str],   # 警告信息
        }

    Raises:
        FileNotFoundError: 文件不存在。
        ValueError: 文件解析失败或声部索引越界。
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    score = m21converter.parse(str(file_path))
    warnings: List[str] = []

    # ---------- 声部 ----------
    parts = list(score.parts)
    num_parts = len(parts)
    if num_parts == 0:
        raise ValueError("MusicXML 中未找到任何声部。")
    if part_index >= num_parts:
        raise ValueError(f"声部索引 {part_index} 越界，共 {num_parts} 个声部。")

    target_part = parts[part_index]
    part_name = target_part.partName or f"Part {part_index + 1}"

    # ---------- 元数据提取 ----------
    title = extract_title(score)
    composer = extract_composer(score)
    ks, key_name_str = extract_key(target_part, warnings)
    ts, ts_str = extract_time_signature(target_part, warnings)
    qpm = extract_tempo(target_part)

    # ---------- 音阶准备 ----------
    tonic_pc = ks.tonic.pitchClass
    scale_pc_map = build_scale_pc_map(tonic_pc)
    tonic_octave = resolve_tonic_octave(ks)
    beat_ql = 4.0 / ts.denominator

    # ---------- 逐小节转换 ----------
    measures = list(target_part.getElementsByClass(stream.Measure))
    total_measures = len(measures)

    # 每小节转换为 (tokens, lyrics)
    measure_results: List[Tuple[List[str], List[Tuple[str, str]]]] = []
    for m_idx, measure in enumerate(measures):
        m_tokens, m_lyrics = _convert_measure(
            measure, scale_pc_map, tonic_octave, ts, beat_ql, warnings,
        )
        if m_tokens:
            measure_results.append((m_tokens, m_lyrics))

    # ---------- 判断歌词语言 ----------
    all_lyrics: List[Tuple[str, str]] = []
    for _, m_lyrics in measure_results:
        all_lyrics.extend(m_lyrics)
    has_lyrics = any(t[0].strip() and t[0] != "%" for t in all_lyrics)
    is_cjk = _is_cjk_lyrics([t[0] for t in all_lyrics]) if has_lyrics else True

    # ---------- 按行分组（每行 4 小节） ----------
    measures_per_line = 4
    header = build_header(title, composer, key_name_str, ts_str, qpm)
    spnmn_lines = [header]

    for line_start in range(0, len(measure_results), measures_per_line):
        chunk = measure_results[line_start:line_start + measures_per_line]
        spnmn_lines.append("---")

        # 组装 N: 行
        note_parts = [" ".join(tokens) for tokens, _ in chunk]
        # 最后一行最后一个小节用 ||| 结尾，其余用 |
        is_last_line = line_start + measures_per_line >= len(measure_results)
        separator = " ||| " if is_last_line else " | "
        note_line = " | ".join(note_parts)
        if is_last_line:
            note_line += " |||"
        else:
            note_line += " |"
        spnmn_lines.append(f"N: {note_line}")

        # 组装歌词行
        if has_lyrics:
            line_lyrics: List[Tuple[str, str]] = []
            for _, m_lyrics in chunk:
                line_lyrics.extend(m_lyrics)

            if any(t[0].strip() and t[0] != "%" for t in line_lyrics):
                if is_cjk:
                    lyric_text = "".join(t[0] for t in line_lyrics)
                    spnmn_lines.append(f"Lc: {lyric_text}")
                else:
                    lyric_text = _build_lw_line(line_lyrics)
                    spnmn_lines.append(f"Lw: {lyric_text}")

    spnmn_text = "\n".join(spnmn_lines) + "\n"

    return {
        "spnmn_text": spnmn_text,
        "key_name": key_name_str,
        "time_signature": ts_str,
        "total_measures": total_measures,
        "part_name": part_name,
        "num_parts": num_parts,
        "warnings": warnings,
    }


# ============================================================
# 小节转换
# ============================================================


def _convert_measure(
    measure: stream.Measure,
    scale_pc_map: Dict[int, int],
    tonic_octave: int,
    ts: meter.TimeSignature,
    beat_ql: float,
    warnings: List[str],
) -> Tuple[List[str], List[Tuple[str, str]]]:
    """将一个小节转换为 spnmn token 列表和歌词列表。

    采用两步策略：
    1. 将音符按拍分组（亚拍音符归入所属拍）
    2. 跨拍音符在起始拍放置 token，后续拍标记为已占用

    Args:
        measure: music21 Measure。
        scale_pc_map: 音阶 PC 映射。
        tonic_octave: 参考八度。
        ts: 当前拍号。
        beat_ql: 每拍 quarterLength。
        warnings: 收集警告。

    Returns:
        (tokens, lyrics) 元组。lyrics 为 [(text, syllabic), ...] 列表。
    """
    elements = list(measure.flatten().notesAndRests)
    elements = deduplicate_by_offset(elements)
    elements.sort(key=lambda e: float(e.offset))

    if not elements:
        return [], []

    num_beats = ts.numerator
    # 每一拍存储该拍内的亚拍音符:
    # (token, ql, lyric_tuple, is_tied, is_tie_rhs)
    BeatEntry = Tuple[str, float, Tuple[str, str], bool, bool]
    beats: List[List[BeatEntry]] = [[] for _ in range(num_beats)]
    # 标记哪些拍被前面的长音符占用（用延时线填充）
    consumed: List[bool] = [False] * num_beats

    for el in elements:
        el_offset = float(el.offset)
        token, lyric_char, is_grace = _element_to_token(
            el, scale_pc_map, tonic_octave, warnings,
        )
        is_tied = _has_tie_continue(el)
        is_tie_rhs = _is_tie_right_side(el)
        ql = float(el.duration.quarterLength)

        if is_grace:
            warnings.append(f"小节 {measure.number}: 倚音已跳过。")
            continue

        beat_idx = int(el_offset / beat_ql)
        beat_idx = max(0, min(beat_idx, num_beats - 1))

        # 判断音符是否在拍内的亚拍位置
        beat_start = beat_idx * beat_ql
        sub_offset = el_offset - beat_start

        if sub_offset < 0.01 and ql >= beat_ql:
            # 音符从拍头开始且 >= 1 拍 → 占据整拍或多拍
            beats[beat_idx].append(
                (token, ql, lyric_char, is_tied, is_tie_rhs),
            )
            # 标记后续被占用的拍
            occupied_beats = int(ql / beat_ql)
            # 附点判断：如果占用 n.5 拍，多占一拍
            remainder = ql - occupied_beats * beat_ql
            for i in range(1, occupied_beats):
                if beat_idx + i < num_beats:
                    consumed[beat_idx + i] = True
        else:
            # 亚拍音符（八分、十六分等）
            beats[beat_idx].append(
                (token, ql, lyric_char, is_tied, is_tie_rhs),
            )

    # 逐拍输出
    result_tokens: List[str] = []
    result_lyrics: List[Tuple[str, str]] = []  # [(text, syllabic), ...]

    for b_idx, beat_group in enumerate(beats):
        if consumed[b_idx]:
            continue

        if not beat_group:
            result_tokens.append("0")
            continue

        if len(beat_group) == 1:
            tok, ql, lyric_tup, is_tied, is_tie_rhs = beat_group[0]
            expanded = expand_to_beat_tokens(tok, ql, beat_ql, is_tied)
            result_tokens.extend(expanded)
            # 歌词：跳过休止符和 ~ 连音线右侧音符（Sparks NMN 自动跳过）
            if tok != "0" and not is_tie_rhs:
                if lyric_tup[0]:
                    result_lyrics.append(lyric_tup)
                else:
                    result_lyrics.append(("%", "single"))
        else:
            sub_tokens: List[Tuple[str, float]] = []
            for tok, ql, lyric_tup, is_tied, is_tie_rhs in beat_group:
                full_tok = tok + ("~" if is_tied else "")
                sub_tokens.append((full_tok, ql))
                # 歌词：跳过休止符和 ~ 连音线右侧音符
                if tok != "0" and not is_tie_rhs:
                    if lyric_tup[0]:
                        result_lyrics.append(lyric_tup)
                    else:
                        result_lyrics.append(("%", "single"))
            grouped = group_sub_beat_tokens(sub_tokens, beat_ql)
            result_tokens.append(grouped)

    return result_tokens, result_lyrics


# ============================================================
# 音符元素转换
# ============================================================


def _element_to_token(
    el: Any,
    scale_pc_map: Dict[int, int],
    tonic_octave: int,
    warnings: List[str],
) -> Tuple[str, str, bool]:
    """将 music21 元素转换为 (token, lyric_char, is_grace)。

    Args:
        el: Note / Rest / Chord。
        scale_pc_map: 音阶映射。
        tonic_octave: 参考八度。
        warnings: 警告收集。

    Returns:
        (token_str, lyric_char, is_grace_note)。
    """
    is_grace = (
        hasattr(el, "duration")
        and el.duration is not None
        and el.duration.isGrace
    )

    empty_lyric = ("", "")

    if isinstance(el, note.Rest):
        return "0", empty_lyric, is_grace

    if isinstance(el, chord.Chord):
        top_pitch = el.pitches[-1]
        token = format_note_token(top_pitch, scale_pc_map, tonic_octave)
        lyric = _extract_lyric(el)
        return token, lyric, is_grace

    if isinstance(el, note.Note):
        token = format_note_token(el.pitch, scale_pc_map, tonic_octave)
        lyric = _extract_lyric(el)
        return token, lyric, is_grace

    return "0", empty_lyric, False


def _build_lw_line(lyric_tuples: List[Tuple[str, str]]) -> str:
    """将歌词 tuples 组装为 Lw: 格式（西文歌词，空格分隔，连字符连接音节）。

    syllabic 类型：
    - 'single': 独立单词
    - 'begin': 多音节单词的开头
    - 'middle': 多音节单词的中间
    - 'end': 多音节单词的结尾
    """
    parts: List[str] = []
    for text, syl in lyric_tuples:
        text = text.strip()
        if not text or text == "%":
            parts.append("%")
            continue
        if syl in ("begin", "middle"):
            parts.append(text + "-")
        else:
            parts.append(text)
    return " ".join(parts)


def _is_cjk_lyrics(fragments: List[str]) -> bool:
    """判断歌词是否为 CJK 字符（中文/日文/韩文）。"""
    cjk_count = 0
    total = 0
    for frag in fragments:
        for ch in frag:
            if ch.strip():
                total += 1
                if "\u4e00" <= ch <= "\u9fff" or "\u3040" <= ch <= "\u30ff":
                    cjk_count += 1
    if total == 0:
        return True
    return cjk_count / total > 0.3


def _extract_lyric(el: Any) -> Tuple[str, str]:
    """提取元素的第一个歌词和 syllabic 类型。

    Returns:
        (text, syllabic)。syllabic 为 'single'/'begin'/'middle'/'end'/''。
    """
    if hasattr(el, "lyrics") and el.lyrics:
        for lyric_obj in el.lyrics:
            if lyric_obj.text:
                syl = getattr(lyric_obj, "syllabic", "single") or "single"
                return lyric_obj.text, syl
    return "", ""


def _has_tie_continue(el: Any) -> bool:
    """检查元素是否有 tie start（需要 ~ 标记）。"""
    if hasattr(el, "tie") and el.tie is not None:
        return el.tie.type in ("start", "continue")
    return False


def _is_tie_right_side(el: Any) -> bool:
    """检查元素是否为延长连音线右侧音符。

    在 Sparks NMN 中，~ 连音线右侧的音符会被自动跳过，
    不参与歌词配对，因此不需要为它们生成歌词条目。

    Args:
        el: music21 元素。

    Returns:
        True 表示是连音线右侧（stop 或 continue）。
    """
    if hasattr(el, "tie") and el.tie is not None:
        return el.tie.type in ("stop", "continue")
    return False
