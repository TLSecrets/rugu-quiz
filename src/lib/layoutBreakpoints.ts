/**
 * 与 tokens.css 中 --layout-tablet / --layout-desktop 保持一致（媒体查询不能读 CSS 变量作 min-width 时，用此常量）。
 * tablet ≈ 768px @16；desktop ≈ 900px @16。
 */
export const LAYOUT_TABLET = '48rem'
export const LAYOUT_DESKTOP = '56.25rem'

export const MQ_TABLET = `(min-width: ${LAYOUT_TABLET})`
export const MQ_DESKTOP = `(min-width: ${LAYOUT_DESKTOP})`
