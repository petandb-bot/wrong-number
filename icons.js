/* All sixteen pictograms are original hand-drawn-style SVG shapes.
   Shared stroke width, rounded joins and palette keep the pad artwork cohesive. */
(()=>{'use strict';
const drawings=[
// PRESS — a happy swollen heart
'<path d="M32 49C15 39 10 29 15 20c4-8 14-8 17-2 4-7 15-6 19 2 6 11-4 22-19 29Z" fill="var(--icon-fill)"/><circle cx="25" cy="30" r="1.8"/><circle cx="39" cy="30" r="1.8"/><path d="M28 36q4 4 8 0"/>',
// FALL — a candy drop
'<path d="M32 8c0 12-19 20-19 33 0 11 8 17 19 17s19-6 19-17C51 28 32 21 32 8Z" fill="var(--icon-fill)"/><path d="M24 43q2 7 9 7"/><circle cx="39" cy="40" r="2"/>',
// CORNER — a crumpled wrapper
'<path d="M8 24l12 6-2-13 10 4 8-10 7 13 13-5-4 15 4 13-15-2-10 10-7-12-14 2 4-13Z" fill="var(--icon-fill)"/><circle cx="27" cy="32" r="2"/><circle cx="39" cy="32" r="2"/><path d="M29 39q5-3 9 0"/>',
// BEND — sleepy soft worm
'<path d="M12 41c6-22 25-26 31-15 8 14-9 21-17 14-9-8 5-20 21-11" fill="none" stroke-width="8"/><path d="M47 29l7-5"/><circle cx="14" cy="40" r="2" fill="var(--icon-fill)"/>',
// TICK — eye with tiny feet
'<path d="M10 32q22-27 44 0-22 27-44 0Z" fill="var(--icon-fill)"/><circle cx="32" cy="32" r="8"/><circle cx="34" cy="30" r="2" fill="#fff" stroke="none"/><path d="M22 50l-4 6M42 50l4 6"/>',
// WOOD — bite-sized biscuit
'<rect x="14" y="15" width="36" height="37" rx="12" fill="var(--icon-fill)"/><path d="M39 15a10 10 0 0 0 11 11"/><circle cx="25" cy="31" r="2"/><circle cx="39" cy="31" r="2"/><path d="M26 40q6 5 12 0"/>',
// TIN — smiling can with ears
'<path d="M17 20q15-8 30 0v31q-15 10-30 0Z" fill="var(--icon-fill)"/><ellipse cx="32" cy="20" rx="15" ry="6" fill="#fffae0"/><path d="M22 30v7M42 30v7M26 43q6 4 12 0"/>',
// SNAP — cheerful poison flower
'<circle cx="32" cy="32" r="8" fill="var(--icon-fill)"/><path d="M32 24C15 6 13 24 24 30 3 29 16 47 27 39 23 61 42 56 39 39c16 10 25-7 2-10 16-10 0-25-9-5Z" fill="var(--icon-fill)"/><circle cx="29" cy="31" r="1.4"/><circle cx="35" cy="31" r="1.4"/>',
// VOWEL — blushing lips
'<path d="M9 33c9-3 13-13 23-5 10-8 14 2 23 5-8 14-18 17-23 17S15 47 9 33Z" fill="var(--icon-fill)"/><path d="M14 35q18 8 36 0"/><path d="M25 43h14"/>',
// GLASS — tiny delicate cup with crack
'<path d="M16 13h32l-4 32-12 8-12-8Z" fill="var(--icon-fill)"/><path d="M22 23h20M34 23l-6 9 7 4-3 8"/><circle cx="22" cy="14" r="2"/>',
// ERROR — mischievous skull
'<path d="M18 39C4 27 14 13 32 13s28 14 14 26v12H18Z" fill="var(--icon-fill)"/><path d="M24 47v5m8-5v5m8-5v5"/><path d="M21 31l7 4-7 3M43 31l-7 4 7 3"/><path d="M29 44h6"/>',
// CUT — stitched toy button
'<circle cx="32" cy="32" r="22" fill="var(--icon-fill)"/><circle cx="25" cy="26" r="3"/><circle cx="40" cy="26" r="3"/><circle cx="25" cy="41" r="3"/><circle cx="40" cy="41" r="3"/><path d="M9 34l8-2m30 0 8 2"/>',
// REVERSE — comet with a tiny ghost trail
'<path d="M43 13c-20-3-34 8-34 27m0 0-4-6m4 6 7-3"/><path d="M29 29c0-9 17-15 22-4 3 7-5 20-11 24l-9-7Z" fill="var(--icon-fill)"/><circle cx="40" cy="32" r="2"/>',
// HOLLOW — little haunted house
'<path d="M11 29 32 11l21 18v24H11Z" fill="var(--icon-fill)"/><path d="M23 52V38q9-9 18 0v14"/><circle cx="23" cy="29" r="2"/><circle cx="41" cy="29" r="2"/>',
// AIR — puff cloud with a smile
'<path d="M16 49C2 47 4 30 17 29c-2-18 20-24 28-10 17-2 19 23 8 29Z" fill="var(--icon-fill)"/><circle cx="27" cy="37" r="2"/><circle cx="39" cy="37" r="2"/><path d="M28 43q5 4 10 0"/>',
// GHOST — shy ribbon ghost
'<path d="M14 51V28C14 7 49 7 49 28v24l-9-7-9 8-9-8Z" fill="var(--icon-fill)"/><circle cx="25" cy="31" r="3"/><circle cx="40" cy="31" r="3"/><path d="M29 41q3 3 6 0"/><path d="M16 16l-5-6M47 16l5-6"/>'
];
const icon=(n)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#452451" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" style="--icon-fill:${['#ffe0fa','#f8ffd7','#ffe0a1','#cffff5'][n%4]}">${drawings[n]||''}</svg>`;
window.WrongIcons={icon};
})();
