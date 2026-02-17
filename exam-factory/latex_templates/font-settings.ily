% Gonville 字体设置
\paper {
  #(define fonts
    (set-global-fonts
     #:music "gonville"
     #:brace "gonville"
    ))
}

\layout {
  \context {
    \Staff
    \override StaffSymbol.thickness = #0.5  % 默认是 1.0，越小越细
  }
}
