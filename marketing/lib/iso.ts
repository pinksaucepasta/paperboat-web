/**
 * Build-time isometric geometry.
 *
 * Every illustration on the marketing site is drawn on one axonometric lattice
 * so the whole page reads as a single technical drawing. Scenes call these
 * helpers in Astro frontmatter, which means the geometry is resolved during
 * `astro build` and ships as plain `<polygon>` markup — no client JavaScript,
 * no layout shift, and the drawing scales with the viewBox instead of a raster.
 *
 * Lattice convention (true isometric, 30° axes):
 *   +x runs down-and-right, +y runs down-and-left, +z runs straight up.
 *   The camera therefore sees a box's top face, its `+x` face on the screen
 *   left, and its `+y` face on the screen right.
 */

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

const COS30 = Math.sqrt(3) / 2;
const SIN30 = 0.5;

/** Two decimals is below a pixel at every size we render, and keeps the HTML small. */
const round = (n: number) => Math.round(n * 100) / 100;

/** Project a lattice point into SVG user space, offset by the scene origin. */
export function project([x, y, z]: Vec3, origin: Vec2 = [0, 0]): Vec2 {
  return [
    round(origin[0] + (x - y) * COS30),
    round(origin[1] + (x + y) * SIN30 - z),
  ];
}

/** `points` attribute for a `<polygon>`/`<polyline>` given lattice points. */
export function poly(points: readonly Vec3[], origin?: Vec2): string {
  return points.map((p) => project(p, origin).join(",")).join(" ");
}

/** `x1/y1/x2/y2` for a `<line>` between two lattice points. */
export function segment(a: Vec3, b: Vec3, origin?: Vec2) {
  const [x1, y1] = project(a, origin);
  const [x2, y2] = project(b, origin);
  return { x1, y1, x2, y2 };
}

export interface BoxFaces {
  /** Upward face at `z + h`. Lightest step of the ramp. */
  top: string;
  /** Face at `y + d`, which the projection places on the screen left. Mid tone. */
  left: string;
  /** Face at `x + w`, which lands on the screen right. Darkest tone. */
  right: string;
}

/**
 * The three visible faces of an axis-aligned box, given its minimum corner and
 * its extent along each axis. Hidden faces are never emitted.
 */
export function box(origin: Vec3, size: Vec3, sceneOrigin?: Vec2): BoxFaces {
  const [x, y, z] = origin;
  const [w, d, h] = size;
  const t = z + h;
  return {
    top: poly(
      [
        [x, y, t],
        [x + w, y, t],
        [x + w, y + d, t],
        [x, y + d, t],
      ],
      sceneOrigin,
    ),
    left: poly(
      [
        [x, y + d, t],
        [x + w, y + d, t],
        [x + w, y + d, z],
        [x, y + d, z],
      ],
      sceneOrigin,
    ),
    right: poly(
      [
        [x + w, y, t],
        [x + w, y + d, t],
        [x + w, y + d, z],
        [x + w, y, z],
      ],
      sceneOrigin,
    ),
  };
}

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The ground plane of a scene, as a polygon. */
export function plane({ x0, x1, y0, y1 }: Bounds, sceneOrigin?: Vec2): string {
  return poly(
    [
      [x0, y0, 0],
      [x1, y0, 0],
      [x1, y1, 0],
      [x0, y1, 0],
    ],
    sceneOrigin,
  );
}

/** How far every lid on the site leans back off vertical. */
export const LID_TILT = (23 * Math.PI) / 180;

export interface Laptop {
  /** The base, as an ordinary box. */
  base: BoxFaces;
  /**
   * A point on the lid's plane: `u` runs across the screen, `v` from the hinge
   * at 0 to the lid's top edge at 1. Callers place screen detail with it, so the
   * detail follows the lid rather than being positioned against it by hand.
   */
  lid: (u: number, v: number) => Vec3;
  /** The lid's outward face. */
  lidFace: string;
}

/**
 * An open laptop: a base with a lid hinged on its far edge.
 *
 * The lid's length is the base's depth rather than a free parameter, so the two
 * halves are the same panel and the lid closes flush over the keyboard. Every
 * scene builds its laptop through here — when the length was written out by
 * hand each drawing drifted to a different, shorter lid, which left a stub of
 * base uncovered and squashed the screen towards 2:1.
 */
export function laptop(
  origin: Vec3,
  size: Vec3,
  sceneOrigin?: Vec2,
  tilt: number = LID_TILT,
): Laptop {
  const [x, y, z] = origin;
  const [w, d, h] = size;
  const lid = (u: number, v: number): Vec3 => [
    x + w * u,
    y - d * Math.sin(tilt) * v,
    z + h + d * Math.cos(tilt) * v,
  ];
  return {
    base: box(origin, size, sceneOrigin),
    lid,
    lidFace: poly([lid(0, 0), lid(1, 0), lid(1, 1), lid(0, 1)], sceneOrigin),
  };
}

export interface PaperBoatFaces {
  /** Inside of the hull floor — the one true top face, so the lightest step. */
  floor: string;
  /** Near flank, aft of the beam crease. Outside of the paper, screen left. */
  flankAft: string;
  /** Near flank, forward of the beam crease. */
  flankFore: string;
  /** Far flank seen from inside, aft of the beam crease. */
  troughAft: string;
  /** Far flank seen from inside, forward of the beam crease. */
  troughFore: string;
  /** Inside of the stern fold, rising to the aft point. */
  sternInner: string;
  /** Outside of the bow fold, rising to the fore point. Nearest the camera. */
  bowOuter: string;
  /** The sail, standing on the floor along the hull's centreline. */
  sail: string;
  /** The two upswept points, as lattice coordinates, for callers that mark them. */
  points: { aft: Vec3; fore: Vec3 };
}

/**
 * The folded paper boat.
 *
 * The hull is one sheet: the floor is a flat rectangle, both flanks flare
 * outward as they rise, and at each end the two flanks pinch together into a
 * single upswept point. Those points carry the identity of the fold.
 *
 * A sail rises from the floor on the centreline, matching the brand mark, which
 * carries one. It is drawn as a fold of the same sheet rather than a mast with
 * cloth on it — a flat triangle standing in the hull's long axis — so the whole
 * drawing stays one continuous surface.
 *
 * Only the faces the axonometric camera can actually see are emitted. Because
 * the flanks lean outward, the near flank projects clear of the opening, so the
 * viewer reads the outside of the near wall and the inside of the far one —
 * which is what makes the form read as open paper instead of a solid block.
 *
 * `scale` multiplies the lattice so the same fold serves a 16px favicon and a
 * hero-sized drawing without redrawing it.
 */
export function paperBoat(scale = 1, sceneOrigin?: Vec2): PaperBoatFaces {
  /** Half the floor's width, the beam crease, and the flare at the gunwale. */
  const FLOOR = { x0: 6, x1: 24, y0: 5, y1: 11 };
  const BEAM = 15;
  const GUNWALE = { z: 6, near: 14.5, far: 1.5 };
  const POINT = { x0: 0, x1: 30, y: 8, z: 13 };
  /**
   * The sail, on the centreline `POINT.y`. Its foot sits at gunwale height so
   * the hull's near wall reads as holding it, and it spans most of the opening —
   * a sail rooted down at the floor tapers to a spike by the time it clears the
   * flanks, which reads as a mast rather than canvas.
   */
  const SAIL = { x0: 6, x1: 24, peak: 15, foot: 6, z: 19 };

  const v = (x: number, y: number, z: number): Vec3 => [
    x * scale,
    y * scale,
    z * scale,
  ];
  const p = (points: readonly Vec3[]) => poly(points, sceneOrigin);

  const aft = v(POINT.x0, POINT.y, POINT.z);
  const fore = v(POINT.x1, POINT.y, POINT.z);
  /** Where the beam crease meets each gunwale. */
  const creaseNear = v(BEAM, GUNWALE.near, GUNWALE.z);
  const creaseFar = v(BEAM, GUNWALE.far, GUNWALE.z);

  return {
    floor: p([
      v(FLOOR.x0, FLOOR.y0, 0),
      v(FLOOR.x1, FLOOR.y0, 0),
      v(FLOOR.x1, FLOOR.y1, 0),
      v(FLOOR.x0, FLOOR.y1, 0),
    ]),
    flankAft: p([
      v(FLOOR.x0, FLOOR.y1, 0),
      v(BEAM, FLOOR.y1, 0),
      creaseNear,
      aft,
    ]),
    flankFore: p([
      v(BEAM, FLOOR.y1, 0),
      v(FLOOR.x1, FLOOR.y1, 0),
      fore,
      creaseNear,
    ]),
    troughAft: p([
      v(FLOOR.x0, FLOOR.y0, 0),
      v(BEAM, FLOOR.y0, 0),
      creaseFar,
      aft,
    ]),
    troughFore: p([
      v(BEAM, FLOOR.y0, 0),
      v(FLOOR.x1, FLOOR.y0, 0),
      fore,
      creaseFar,
    ]),
    sternInner: p([
      v(FLOOR.x0, FLOOR.y0, 0),
      v(FLOOR.x0, FLOOR.y1, 0),
      aft,
    ]),
    bowOuter: p([
      v(FLOOR.x1, FLOOR.y0, 0),
      v(FLOOR.x1, FLOOR.y1, 0),
      fore,
    ]),
    sail: p([
      v(SAIL.x0, POINT.y, SAIL.foot),
      v(SAIL.x1, POINT.y, SAIL.foot),
      v(SAIL.peak, POINT.y, SAIL.z),
    ]),
    points: { aft, fore },
  };
}

/** Blueprint rule lines across the ground plane, both lattice axes. */
export function gridLines(b: Bounds, step: number, sceneOrigin?: Vec2) {
  const lines = [];
  for (let x = b.x0 + step; x < b.x1; x += step) {
    lines.push(segment([x, b.y0, 0], [x, b.y1, 0], sceneOrigin));
  }
  for (let y = b.y0 + step; y < b.y1; y += step) {
    lines.push(segment([b.x0, y, 0], [b.x1, y, 0], sceneOrigin));
  }
  return lines;
}

/**
 * Ordered-dither ramp.
 *
 * An 8×8 Bayer matrix thresholded at N gives N/64 coverage, so a sequence of
 * levels reads as a continuous tone ramp built entirely from hard-edged dots —
 * the shading language the brand uses instead of gradients.
 *
 * The matrix is 8×8 rather than 4×4 and its dot is one user unit rather than
 * two, which puts four times as many dots in the same area: the tile keeps its
 * 8-unit footprint, so every scene's tone is unchanged, but the texture reads
 * as a fine mechanical screen instead of a coarse checker. The extra depth also
 * breaks up the diagonal banding a 4×4 leaves on large faces like the ground
 * plane, where a single tile used to repeat across the whole polygon.
 */
const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/**
 * Levels rendered as patterns, from a whisper of ink to nearly solid.
 *
 * Levels stay on the sixteenths the scenes were composed against — `ink(6)` is
 * the same tone it always was — and are scaled onto the deeper matrix below.
 */
export const DITHER_LEVELS = [1, 2, 4, 6, 8, 10, 12, 14] as const;
export type DitherLevel = (typeof DITHER_LEVELS)[number];
/** Denominator of a level: coverage is `level / DITHER_STEPS`. */
const DITHER_STEPS = 16;

/** Size of one dot, in user units. Dots stay square and crisp at any level. */
export const DITHER_DOT = 1;
/** A Bayer tile is 8 dots on a side. */
export const DITHER_TILE = DITHER_DOT * 8;

/**
 * One tile's dots at the given threshold, as `[x, y, width]` runs.
 *
 * Horizontally adjacent dots are merged into a single rect. At the dense end of
 * the ramp that roughly halves the element count, which matters now that a tile
 * holds 64 cells instead of 16.
 */
export function ditherCells(level: number): Array<[number, number, number]> {
  const size = BAYER_8.length;
  const threshold = (level / DITHER_STEPS) * size * size;
  const runs: Array<[number, number, number]> = [];

  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (BAYER_8[row][col] >= threshold) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < size && BAYER_8[row][end] < threshold) end += 1;
      runs.push([col * DITHER_DOT, row * DITHER_DOT, (end - col) * DITHER_DOT]);
      col = end;
    }
  }
  return runs;
}

/** Ink-on-canvas pattern id for a level. */
export const ink = (level: DitherLevel) => `url(#pb-dither-${level})`;
/** Canvas-on-ink pattern id — dots knocked out of a solid indigo face. */
export const knockout = (level: DitherLevel) => `url(#pb-dither-out-${level})`;
