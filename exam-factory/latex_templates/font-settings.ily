% LilyPond 字体与排版设置
% 使用默认 emmentaler 字体（gonville 需要额外安装）
\layout {
  \context {
    \Staff
    \override StaffSymbol.thickness = #0.5  % 默认是 1.0，越小越细
  }
}
