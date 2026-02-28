"""MusicXML → Sparks NMN (.spnmn) 格式转换模块。

提供 MusicXML 文件到 .spnmn 简谱格式的自动转换功能。
使用 music21 库解析 MusicXML，输出符合 Sparks NMN 规范的文本。

用法::

    from app.modes.musicxml import convert_musicxml_to_spnmn

    result = convert_musicxml_to_spnmn("path/to/score.musicxml")
    print(result["spnmn_text"])
"""

from app.modes.musicxml.converter import convert_musicxml_to_spnmn

__all__ = ["convert_musicxml_to_spnmn"]
