// Schematic floor geometry for D. H. Hill Jr. Library, traced by eye from NC
// State Libraries' floor maps (lib.ncsu.edu/hill/map, Oct 2026 PNGs).
//
// Frame: pixels on the full-size Floor 1 map (3392 × 1555). The other maps are
// drawn at the same scale (their elevator icons are spaced within a pixel of
// Floor 1's), so each one lines up by a fixed offset, found from the centres of
// the north and south tower elevator banks. Floors 4–9 share one tower plate
// and are traced in Floor 5's own pixels. As with Hunt, rooms are on the right
// floor in roughly the right place; where a map labels a run ("5401–5412") the
// order inside the run is assumed.

import type { Floor, Pt, Shape } from "./hunt-geometry.ts";

export type HillFloor = Floor;

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
// Edges of rect(): 0 north, 1 east, 2 south, 3 west.
const N = 0, E = 1, S = 2, W = 3;

function strip(refs: string[], x0: number, y0: number, x1: number, y1: number, front: number): Shape[] {
  const across = x1 - x0 > y1 - y0;
  const step = (across ? x1 - x0 : y1 - y0) / refs.length;
  return refs.map((ref, i) => ({
    kind: "room",
    ref,
    label: ref,
    front,
    poly: across ? rect(x0 + i * step, y0, x0 + (i + 1) * step, y1) : rect(x0, y0 + i * step, x1, y0 + (i + 1) * step),
  }));
}

/** Rough circle, for the round gallery on Floor 3. */
const ring = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 12 }, (_, i) => [Math.round(cx + r * Math.cos((i * Math.PI) / 6)), Math.round(cy + r * Math.sin((i * Math.PI) / 6))]);

/** Moves a floor traced in its own map's pixels into Floor 1's frame. */
function shifted([dx, dy]: Pt, floor: HillFloor): HillFloor {
  const move = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [x + dx, y + dy]);
  return {
    ...floor,
    plate: move(floor.plate),
    extra: floor.extra?.map(move),
    shapes: floor.shapes.map((s) => ({ ...s, poly: move(s.poly), at: s.at && move([s.at])[0] })),
  };
}

/** Where each map's own pixels sit in Floor 1's frame. */
export const MAP_OFFSET: Record<number, Pt> = { [-1]: [888, 854], 0: [1008, 888], 1: [0, 0], 2: [18, -15], 3: [15, -15], 4: [1041, 147], 5: [1041, 147], 6: [1041, 147], 7: [1041, 147], 8: [1041, 147], 9: [1041, 147] };

// ── Floor 1 (Floor 1's own pixels) ───────────────────────────────────────────
// West wing, tower and east wing in one plate. The void over the Ground Floor
// entrance sits outside it; the Mezzanine, a few steps down, is drawn inside.
const floor1: HillFloor = {
  traced: true,
  plate: [
    [95, 373], [1115, 373], [1115, 383], [1238, 383], [1238, 238], [1658, 238], [1658, 390], [1788, 390],
    [1788, 193], [2055, 193], [2055, 53], [2193, 53], [2193, 193], [3245, 193], [3245, 945], [2718, 945],
    [2718, 968], [2585, 968], [2585, 945], [2185, 945], [2185, 1195], [2155, 1195], [2155, 1355], [2020, 1355],
    [2020, 1190], [1512, 1190], [1512, 958], [1235, 958], [1235, 792], [1112, 792], [1112, 953], [95, 953],
  ],
  shapes: [
    // West wing
    { kind: "core", poly: rect(100, 380, 315, 590) },
    { kind: "core", poly: rect(158, 590, 245, 762), label: "Restrooms" },
    { kind: "stair", poly: rect(245, 618, 318, 762), dir: "up", front: E },
    { kind: "zone", poly: rect(507, 390, 628, 482), fit: "lounge", label: "Lounge seating" },
    { kind: "core", poly: rect(678, 380, 750, 495) },
    { kind: "room", ref: "1319", label: "Hill of Beans Café", poly: rect(750, 380, 855, 495), front: S, fit: "cafe" },
    { kind: "room", ref: "1328", label: "Fishbowl Forum", poly: [[900, 380], [1112, 380], [1112, 648], [960, 648], [905, 560]], front: W, fit: "lounge" },
    { kind: "core", poly: rect(567, 535, 605, 575) },
    { kind: "stair", poly: rect(678, 528, 785, 580), dir: "up", front: S },
    { kind: "zone", ref: "1320", label: "Hill of Beans Seating", poly: rect(563, 595, 810, 720), fit: "lounge" },
    { kind: "room", ref: "1311", label: "Quiet Reading Room B", poly: rect(100, 808, 395, 950), front: N, fit: "quiet" },
    { kind: "room", ref: "1325", label: "Quiet Reading Room", poly: rect(517, 808, 1108, 950), front: N, fit: "quiet" },
    { kind: "zone", ref: "Terrace", label: "Terrace (outdoor)", poly: rect(350, 953, 860, 1093), fit: "empty" },
    // Tower
    { kind: "room", ref: "1222", label: "Makerspace", poly: rect(1117, 385, 1245, 675), front: E, fit: "lab" },
    { kind: "core", poly: rect(1120, 680, 1160, 720) },
    { kind: "stair", poly: rect(1115, 720, 1185, 790), dir: "down", front: E },
    { kind: "stair", poly: rect(1240, 245, 1308, 358), dir: "up", front: S },
    { kind: "core", poly: rect(1263, 358, 1308, 410) },
    { kind: "core", poly: rect(1280, 275, 1578, 528), label: "Vending" },
    { kind: "core", poly: rect(1578, 245, 1655, 408), label: "North tower elevators" },
    { kind: "zone", ref: "Ask Us Lobby", label: "Ask Us Lobby", poly: rect(1245, 600, 1580, 785), fit: "empty" },
    { kind: "counter", ref: "Ask Us", label: "Ask Us", poly: rect(1400, 530, 1508, 600) },
    { kind: "room", ref: "1209", label: "Assistive Technologies Center", poly: rect(1655, 395, 1790, 595), front: W, fit: "lab" },
    { kind: "room", ref: "1204", label: "Quick Print", poly: rect(1655, 595, 1790, 722), front: W, fit: "empty" },
    { kind: "core", poly: rect(1235, 795, 1313, 958), label: "Restrooms" },
    { kind: "core", poly: rect(1585, 795, 1658, 958), label: "Restrooms" },
    { kind: "stair", poly: rect(1315, 960, 1365, 1048), dir: "up", front: N },
    { kind: "stair", poly: rect(1412, 960, 1475, 1108), dir: "down", front: N },
    // Mezzanine, between the tower and the Learning Commons
    { kind: "room", ref: "1402", label: "Game Space", poly: rect(1585, 960, 1660, 1092), front: E, fit: "lounge" },
    { kind: "core", poly: rect(1708, 990, 1785, 1118), label: "South tower elevators" },
    { kind: "core", poly: rect(1658, 785, 1790, 980) },
    { kind: "stair", poly: rect(1822, 988, 1928, 1040), dir: "up", front: S },
    { kind: "core", poly: rect(1822, 1040, 1928, 1100) },
    { kind: "zone", label: "Mezzanine", poly: rect(1515, 1110, 2020, 1188), fit: "lounge" },
    { kind: "core", poly: rect(2020, 1145, 2155, 1355), label: "Restrooms" },
    // East wing
    { kind: "room", ref: "1145", label: "1145", poly: [[1790, 195], [1945, 195], [1925, 300], [1790, 300]], front: S },
    ...strip(["1145A", "1145B"], 1790, 300, 1920, 400, S),
    {
      kind: "zone",
      ref: "Learning Commons",
      label: "Learning Commons",
      fit: "commons",
      poly: [[1820, 420], [1930, 420], [1970, 225], [2418, 225], [2418, 765], [2545, 765], [2545, 915], [2080, 915], [2080, 780], [1820, 780]],
    },
    { kind: "zone", ref: "Armstrong Memorial Popular Reading Lounge", label: "Armstrong Popular Reading", poly: rect(1820, 780, 2080, 915), fit: "lounge" },
    { kind: "core", poly: rect(2445, 490, 2545, 740), label: "Restrooms" },
    ...strip(["1132B", "1132C", "1132E"], 2455, 198, 2710, 272, S),
    { kind: "room", ref: "1132A", label: "1132A", poly: rect(2455, 272, 2525, 400), front: E },
    { kind: "zone", ref: "1132", label: "Graduate Student Commons", poly: [[2525, 272], [2710, 272], [2710, 198], [3140, 198], [3140, 420], [2525, 420]], fit: "commons" },
    { kind: "room", ref: "1144", label: "Friends of the Libraries", poly: rect(3140, 198, 3245, 412), front: W, fit: "empty" },
    { kind: "stair", poly: rect(3008, 412, 3080, 462), dir: "up", front: S },
    { kind: "stair", poly: rect(2060, 60, 2188, 190), dir: "up", front: S },
    { kind: "core", poly: rect(2620, 528, 2652, 562) },
    { kind: "stair", poly: rect(2618, 568, 2712, 618), dir: "up", front: S },
    { kind: "room", ref: "1133A", label: "DML Studio", poly: rect(2770, 500, 2870, 585), front: S, fit: "lab" },
    { kind: "room", ref: "1133", label: "Digital Media Lab", poly: [[2712, 585], [2872, 585], [2872, 722], [2575, 722], [2575, 620], [2712, 620]], front: S, fit: "lab" },
    { kind: "core", poly: rect(2872, 500, 2988, 755) },
    { kind: "core", poly: rect(3012, 500, 3240, 565) },
    { kind: "zone", ref: "1120", label: "Exhibit Gallery", poly: rect(2575, 730, 2988, 815), fit: "exhibit" },
    { kind: "room", ref: "Conservatory", label: "Conservatory", poly: rect(2585, 830, 2718, 968), front: N, fit: "lounge" },
    { kind: "core", poly: rect(2718, 815, 2930, 940) },
    { kind: "counter", ref: "Special Collections Service Desk", label: "Service desk", poly: rect(2935, 850, 2985, 930) },
    { kind: "room", ref: "1128", label: "Special Collections Reading Room", poly: rect(2988, 565, 3245, 940), front: W, fit: "quiet" },
  ],
};

// ── Floor 2 (Floor 2's own pixels) ───────────────────────────────────────────
// The west wing doesn't connect to the tower on this level.
const floor2: HillFloor = {
  traced: true,
  plate: [
    [1215, 253], [1640, 253], [1640, 998], [1912, 998], [1912, 1112], [2077, 1112], [2077, 965], [2033, 965],
    [2033, 68], [2172, 68], [2172, 203], [3230, 203], [3230, 957], [2696, 957], [2696, 916], [2572, 916],
    [2572, 957], [2135, 957], [2135, 1375], [1640, 1375], [1640, 1478], [1085, 1478], [1085, 1360], [1210, 1360],
    [1210, 1118], [1290, 1118], [1290, 985], [1215, 985],
  ],
  extra: [[[75, 388], [1098, 388], [1098, 677], [1147, 677], [1147, 738], [1098, 738], [1098, 969], [75, 969]]],
  shapes: [
    // West wing
    { kind: "core", poly: rect(82, 397, 173, 494), label: "Restrooms" },
    { kind: "core", poly: rect(82, 574, 173, 671), label: "Restrooms" },
    { kind: "zone", ref: "2306", label: "Living Room", poly: rect(173, 397, 656, 486), fit: "lounge" },
    { kind: "room", ref: "2310", label: "2310", poly: rect(656, 397, 808, 486), front: S },
    { kind: "zone", ref: "2312", label: "Faculty Research Commons", poly: rect(808, 397, 1000, 534), fit: "commons" },
    ...strip(["2312A", "2312B", "2312C"], 1008, 460, 1092, 677, W),
    ...strip(["2312J", "2312K", "2312L", "2312M"], 907, 540, 953, 769, E),
    { kind: "room", ref: "2312N", label: "2312N", poly: rect(808, 540, 907, 769), front: W },
    ...strip(["2312D", "2312E", "2312F", "2312G"], 999, 740, 1092, 963, W),
    { kind: "core", poly: rect(1100, 680, 1145, 735) },
    { kind: "core", poly: rect(227, 603, 319, 655) },
    { kind: "stair", poly: rect(227, 655, 319, 769), dir: "up", front: E },
    { kind: "room", ref: "2304", label: "Auditorium", poly: rect(319, 549, 593, 769), front: S, fit: "auditorium" },
    { kind: "stair", poly: rect(639, 540, 770, 591), dir: "up", front: S },
    { kind: "core", poly: rect(730, 591, 804, 769) },
    { kind: "room", ref: "2322", label: "2322", poly: rect(656, 666, 730, 769), front: S, fit: "lab" },
    { kind: "zone", ref: "Study Lounge 2301", label: "Study Lounge", poly: rect(82, 820, 204, 963), fit: "lounge" },
    { kind: "room", ref: "Faculty Senate Chambers", label: "Faculty Senate Chambers", poly: rect(204, 820, 513, 963), front: N, fit: "hall" },
    { kind: "core", poly: rect(513, 820, 661, 963), label: "Faculty Senate office" },
    { kind: "room", ref: "2318", label: "2318", poly: rect(661, 820, 769, 963), front: N, fit: "lab" },
    { kind: "room", ref: "2317", label: "Gaming and VR Studio", poly: rect(769, 820, 953, 963), front: N, fit: "lab" },
    // Tower
    { kind: "stair", poly: rect(1222, 260, 1290, 372), dir: "up", front: S },
    { kind: "core", poly: rect(1222, 372, 1290, 425) },
    ...strip(["2213", "2211"], 1222, 425, 1290, 545, E),
    ...strip(["2207", "2205"], 1222, 630, 1330, 748, E),
    { kind: "room", ref: "2203", label: "2203", poly: rect(1222, 750, 1290, 822), front: E },
    { kind: "core", poly: rect(1222, 822, 1290, 878), label: "Restroom" },
    { kind: "stair", poly: rect(1222, 878, 1290, 978), dir: "up", front: N },
    { kind: "core", poly: rect(1562, 260, 1635, 420), label: "North tower elevators" },
    { kind: "core", poly: rect(1560, 420, 1635, 990), label: "Offices" },
    { kind: "zone", ref: "2200", label: "Academic Success Center", poly: rect(1300, 260, 1555, 980), fit: "commons" },
    { kind: "stair", poly: rect(1298, 990, 1345, 1120), dir: "down", front: S },
    { kind: "stair", poly: rect(1368, 990, 1415, 1120), dir: "up", front: S },
    { kind: "core", poly: rect(1215, 1195, 1255, 1310) },
    { kind: "zone", ref: "South Study Lounge (Floor 2)", label: "South Study Lounge", poly: rect(1260, 1222, 1610, 1450), fit: "lounge" },
    { kind: "room", ref: "2405", label: "2405", poly: rect(1090, 1365, 1210, 1470), front: E },
    { kind: "core", poly: rect(1690, 1005, 1760, 1135), label: "South tower elevators" },
    { kind: "stair", poly: rect(1800, 1002, 1905, 1055), dir: "up", front: S },
    { kind: "core", poly: rect(1800, 1055, 1905, 1118) },
    { kind: "room", ref: "2419", label: "iPearl Innovation Studio", poly: rect(1640, 1210, 1878, 1372), front: N, fit: "lab" },
    { kind: "room", ref: "Office of Undergraduate Research (OUR)", label: "2425", poly: rect(1878, 1210, 1998, 1372), front: N, fit: "empty" },
    { kind: "core", poly: rect(1998, 1210, 2130, 1372), label: "Restrooms" },
    // East wing
    { kind: "stair", poly: rect(2040, 75, 2105, 195), dir: "up", front: S },
    { kind: "core", poly: rect(2033, 203, 2136, 840) },
    { kind: "room", ref: "2112", label: "East Learning Lab A", poly: rect(2163, 211, 2429, 492), front: S, fit: "lab" },
    { kind: "room", ref: "2130", label: "2130", poly: rect(2429, 211, 2569, 451), front: S, fit: "empty" },
    { kind: "room", ref: "2131", label: "Multimedia Seminar Center", poly: rect(2569, 211, 2749, 492), front: S, fit: "lab" },
    { kind: "core", poly: [[2749, 211], [3230, 211], [3230, 957], [2955, 957], [2955, 474], [2749, 474]] },
    { kind: "stair", poly: rect(3000, 427, 3085, 474), dir: "up", front: S },
    { kind: "room", ref: "2113", label: "East Learning Lab B", poly: rect(2163, 525, 2429, 689), front: N, fit: "lab" },
    { kind: "core", poly: rect(2163, 689, 2443, 792) },
    { kind: "zone", ref: "Study Lounge 2142", label: "Study Lounge", poly: rect(2449, 547, 2549, 775), fit: "lounge" },
    { kind: "core", poly: rect(2565, 520, 2595, 560) },
    { kind: "stair", poly: rect(2599, 580, 2694, 630), dir: "up", front: S },
    { kind: "room", ref: "2144", label: "Data Science and AI Academy", poly: [[2694, 525], [2955, 525], [2955, 792], [2560, 792], [2560, 630], [2694, 630]], front: W, fit: "lab" },
    { kind: "core", poly: rect(2166, 842, 2337, 957) },
    { kind: "core", poly: rect(2337, 842, 2431, 955), label: "Restrooms" },
    { kind: "room", label: "Open Knowledge Center", poly: rect(2431, 842, 2702, 916), front: N },
    { kind: "core", poly: rect(2749, 842, 2826, 955), label: "Restrooms" },
    { kind: "room", ref: "2108", label: "Interfaith Prayer & Meditation", poly: rect(2826, 842, 2955, 955), front: N, fit: "quiet" },
    { kind: "zone", ref: "Study Lounge 2424", label: "Study Lounge", poly: rect(2048, 857, 2130, 946), fit: "lounge" },
  ],
};

// ── Floor 3 (Floor 3's own pixels) ───────────────────────────────────────────
// The east wing is Libraries Administration, staff only and closed off from the
// tower on this level. The west wing has no third floor.
const floor3: HillFloor = {
  traced: true,
  plate: [
    [1288, 218], [1570, 218], [1570, 253], [1645, 253], [1645, 420], [1683, 420], [1683, 1003], [1915, 1003],
    [1915, 1112], [2170, 1112], [2170, 1372], [1645, 1372], [1645, 1475], [1085, 1475], [1085, 1365], [1210, 1365],
    [1210, 1115], [1285, 1115], [1285, 990], [1210, 990], [1210, 830], [1175, 830], [1175, 418], [1210, 418],
    [1210, 253], [1288, 253],
  ],
  extra: [[[2030, 70], [2175, 70], [2175, 430], [3085, 430], [3085, 745], [2175, 745], [2175, 965], [2030, 965]]],
  shapes: [
    { kind: "core", label: "Libraries Administration (staff only)", poly: [[2035, 75], [2170, 75], [2170, 435], [3080, 435], [3080, 740], [2170, 740], [2170, 960], [2035, 960]] },
    { kind: "stair", poly: rect(1220, 262, 1290, 372), dir: "up", front: S },
    { kind: "core", poly: rect(1180, 420, 1270, 725), label: "Offices" },
    { kind: "core", poly: rect(1180, 725, 1292, 878), label: "Restrooms" },
    { kind: "stair", poly: rect(1220, 878, 1292, 990), dir: "down", front: N },
    { kind: "core", poly: rect(1590, 260, 1645, 402), label: "North tower elevators" },
    { kind: "core", poly: rect(1562, 402, 1678, 450) },
    { kind: "zone", ref: "North Forum", label: "North Forum Study Lounge", fit: "lounge", poly: [[1315, 268], [1545, 268], [1545, 470], [1655, 470], [1655, 635], [1315, 635]] },
    { kind: "room", ref: "3208A", label: "Visualization Gallery", poly: ring(1430, 810, 85), front: N, fit: "showcase" },
    { kind: "core", poly: rect(1562, 668, 1678, 822), label: "Restrooms" },
    { kind: "room", ref: "3202", label: "Lactation", poly: rect(1562, 822, 1635, 875), front: W, fit: "empty" },
    { kind: "core", poly: rect(1562, 875, 1635, 990) },
    { kind: "stair", poly: rect(1365, 990, 1425, 1115), dir: "down", front: N },
    { kind: "core", poly: rect(1690, 1008, 1762, 1140), label: "South tower elevators" },
    { kind: "stair", poly: rect(1803, 1002, 1910, 1055), dir: "up", front: S },
    { kind: "core", poly: rect(1803, 1055, 1910, 1118) },
    ...strip(["3424", "3426", "3428"], 1803, 1118, 2008, 1168, S),
    { kind: "room", ref: "3425", label: "Data Experience Lab", poly: rect(1640, 1212, 1955, 1372), front: N, fit: "lab" },
    { kind: "room", ref: "3430", label: "South Learning Lab", poly: rect(1960, 1170, 2165, 1370), front: W, fit: "lab" },
    { kind: "core", poly: rect(1220, 1195, 1260, 1310) },
    { kind: "zone", ref: "South Study Lounge (Floor 3)", label: "South Study Lounge", poly: rect(1265, 1212, 1610, 1440), fit: "lounge" },
    { kind: "room", ref: "3405", label: "3405", poly: rect(1090, 1365, 1210, 1470), front: E },
  ],
};

// ── Ground (Ground's own pixels) ─────────────────────────────────────────────
const floorG: HillFloor = {
  traced: true,
  plate: [[288, 68], [658, 68], [658, 90], [920, 90], [920, 207], [1175, 207], [1175, 300], [1143, 300], [1143, 463], [220, 463], [220, 207], [288, 207]],
  shapes: [
    { kind: "zone", label: "Study & lounge seating", fit: "lounge", poly: [[305, 85], [380, 85], [380, 245], [345, 245], [345, 365], [235, 365], [235, 228], [305, 228]] },
    { kind: "stair", poly: rect(400, 68, 460, 215), dir: "up", front: S },
    { kind: "core", poly: rect(495, 75, 655, 245) },
    { kind: "core", poly: rect(700, 100, 775, 230), label: "South tower elevators" },
    { kind: "stair", poly: rect(812, 95, 915, 150), dir: "up", front: S },
    { kind: "core", poly: rect(812, 150, 915, 207) },
    { kind: "counter", ref: "Entrance Desk (Floor G)", label: "Entrance desk", poly: rect(500, 292, 570, 360) },
    { kind: "zone", ref: "G410", label: "Ground Floor Reading Room", poly: rect(635, 232, 1112, 442), fit: "quiet" },
    { kind: "core", poly: rect(228, 372, 305, 418) },
    { kind: "core", poly: rect(305, 380, 348, 415) },
    { kind: "stair", poly: rect(228, 418, 300, 458), dir: "down", front: E },
    { kind: "core", poly: rect(1143, 210, 1175, 300) },
  ],
};

// ── Floor B (B's own pixels) ─────────────────────────────────────────────────
// Mostly staff space; METRC is the public part. The map labels it B401, the
// Spaces API B404, so the shape links by title.
const floorB: HillFloor = {
  traced: true,
  plate: [
    [338, 110], [772, 110], [772, 130], [1037, 130], [1037, 247], [1290, 247], [1290, 343], [1258, 343],
    [1258, 508], [760, 508], [760, 605], [478, 605], [478, 645], [338, 645], [338, 605], [268, 605],
    [268, 498], [278, 498], [278, 205], [338, 205],
  ],
  shapes: [
    { kind: "room", ref: "Media and Education Technology Resource Center (METRC)", label: "METRC", poly: [[345, 118], [615, 118], [615, 240], [475, 240], [475, 495], [345, 495]], front: W, fit: "lab" },
    { kind: "core", poly: rect(345, 322, 420, 372), label: "Restrooms" },
    { kind: "core", poly: rect(432, 418, 468, 452) },
    { kind: "core", label: "Staff only", poly: [[615, 118], [772, 118], [772, 130], [1037, 130], [1037, 247], [1290, 247], [1290, 343], [1258, 343], [1258, 500], [475, 500], [475, 240], [615, 240]] },
    { kind: "core", poly: rect(478, 500, 755, 605) },
    { kind: "stair", poly: rect(282, 252, 332, 300), dir: "up", front: W },
    { kind: "stair", poly: rect(282, 348, 332, 392), dir: "up", front: W },
  ],
};

// ── Floors 4–9 (Floor 5's own pixels) ────────────────────────────────────────
// One tower plate: stacks in the middle, carrels along the walls, study rooms
// at the ends. Floors 4–5 add a south-west wing for the graduate room.
const TOWER_PLATE: Pt[] = [
  [263, 55], [545, 55], [545, 93], [620, 93], [620, 258], [657, 258], [657, 665], [615, 665], [615, 838],
  [888, 838], [888, 950], [1145, 950], [1145, 1052], [1112, 1052], [1112, 1200], [978, 1200], [978, 1215],
];
const GRAD_WING: Pt[] = [[617, 1215], [617, 1310], [62, 1310], [62, 1198], [188, 1198]];
const TOWER_WEST: Pt[] = [[188, 950], [262, 950], [262, 828], [188, 828], [188, 665], [150, 665], [150, 255], [188, 255], [188, 93], [263, 93]];

/** What every tower floor has: stairs, elevators, restrooms, carrels and the stacks. */
function towerCommon(n: number, lowerStacks: boolean): Shape[] {
  return [
    { kind: "stair", poly: rect(195, 95, 265, 210), dir: "up", front: S },
    { kind: "core", poly: rect(228, 210, 268, 258) },
    { kind: "core", poly: rect(565, 98, 615, 255), label: "North tower elevators" },
    { kind: "core", poly: rect(195, 662, 268, 712), label: "Restroom" },
    { kind: "stair", poly: rect(195, 712, 268, 825), dir: "up", front: N },
    { kind: "core", poly: rect(540, 662, 610, 828), label: "Restroom" },
    { kind: "core", poly: rect(662, 845, 740, 975), label: "South tower elevators" },
    { kind: "stair", poly: rect(780, 845, 882, 898), dir: "up", front: S },
    { kind: "core", poly: rect(775, 898, 882, 950) },
    { kind: "room", ref: "Research Study Rooms", label: `${n}216–${n}222`, poly: rect(265, 57, 545, 128), front: S, fit: "carrels" },
    // shortcut: stacks stay bare. Furniture only draws inside an opened space, and stacks aren't one; add shelving if they ever become openable.
    { kind: "zone", ref: `Bookstacks Floor ${n}`, label: "Bookstacks", poly: rect(285, 165, 520, 820), fit: "empty" },
    ...(lowerStacks ? [{ kind: "zone" as const, ref: `Bookstacks Floor ${n}`, poly: rect(245, 850, 520, 1170), fit: "empty" as const }] : []),
    { kind: "zone", ref: `Bookstacks Floor ${n}`, poly: rect(530, 1000, 940, 1170), fit: "empty" },
    { kind: "zone", label: "Carrels", poly: rect(158, 275, 190, 645), fit: "carrels" },
    { kind: "zone", label: "Carrels", poly: rect(748, 965, 950, 995), fit: "carrels" },
  ];
}

function tower(n: number): HillFloor {
  const wing = n <= 5;
  const plate = [...TOWER_PLATE, ...(wing ? GRAD_WING : [[188, 1215] as Pt]), ...TOWER_WEST];
  const lounge = n === 4 || n === 9;
  const shapes: Shape[] = [...towerCommon(n, !lounge)];
  if (lounge)
    shapes.push(
      { kind: "zone", label: "Study lounge", poly: rect(285, 846, 515, 990), fit: "lounge" },
      { kind: "zone", ref: `Bookstacks Floor ${n}`, poly: rect(300, 1000, 520, 1170), fit: "empty" },
    );
  shapes.push({ kind: "zone", label: "Carrels", poly: rect(628, 1175, 935, 1205), fit: "carrels" });
  if (n !== 4) shapes.push({ kind: "zone", label: "Carrels", poly: rect(618, 290, 650, 640), fit: "carrels" });
  if (wing) {
    shapes.push(
      { kind: "room", ref: `${n}400`, label: `${n}400`, poly: rect(62, 1198, 188, 1310), front: E },
      { kind: "room", ref: "Research Study Rooms", label: `${n}401–${n}412`, poly: rect(188, 1258, 615, 1310), front: N, fit: "carrels" },
    );
  }
  // The pair of rooms beside the south elevators, top then bottom.
  const pair: Record<number, [string, string] | [string]> = { 4: ["4430", "4419"], 5: ["5430", "5419"], 6: ["6419", "6406"], 7: ["7419", "7406"], 8: ["8419", "8406"], 9: ["9406"] };
  shapes.push(...strip(pair[n], 538, 828, 612, 950, W));
  if (n === 4) {
    shapes.push(
      { kind: "core", poly: rect(528, 266, 650, 572), label: "Staff" },
      { kind: "zone", label: "Carrels", poly: rect(490, 284, 520, 589), fit: "carrels" },
      { kind: "core", poly: rect(192, 959, 290, 1126) },
      { kind: "core", poly: rect(950, 962, 1145, 1204) },
    );
  } else if (n === 5 || n === 8) {
    shapes.push(
      ...strip([`${n}424`, `${n}425`], 975, 955, 1108, 1003, W),
      ...strip([`${n}426`, `${n}427`], 975, 1045, 1105, 1112, W),
      { kind: "room", ref: `${n}428`, label: `${n}428`, poly: rect(975, 1150, 1045, 1195), front: W },
      { kind: "core", poly: rect(1108, 955, 1140, 1048) },
    );
  } else {
    const [a, b, c] = n === 9 ? ["9411", "9412", "9413"] : [`${n}422`, `${n}424`, `${n}426`];
    shapes.push(...strip([a, b, c], 980, 958, 1105, 1198, W), { kind: "core", poly: rect(1108, 958, 1140, 1048) });
  }
  return { traced: true, plate, shapes };
}

export const FLOORS: Record<number, HillFloor> = Object.fromEntries(
  ([[-1, floorB], [0, floorG], [1, floor1], [2, floor2], [3, floor3], ...[4, 5, 6, 7, 8, 9].map((n) => [n, tower(n)])] as [number, HillFloor][]).map(
    ([n, f]) => [n, shifted(MAP_OFFSET[n], f)],
  ),
);
