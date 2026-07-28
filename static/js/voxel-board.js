import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SQUARE_SIZE = 1;
const BOARD_TOP = 0.16;
const BASE_VOXEL_STEP = 0.092;
// Four subdivisions per original axis makes every visible voxel half the
// previous revision's width, height, and depth while preserving piece bounds.
const VOXEL_DETAIL_SCALE = 4;
const VOXEL_STEP = BASE_VOXEL_STEP / VOXEL_DETAIL_SCALE;
const VOXEL_SIZE = VOXEL_STEP * 0.89;

// Mirrors --board-light / --board-dark in style.css.
const LIGHT_SQUARE = 0xc8a274;
const DARK_SQUARE = 0x6d452a;
// On a walnut board a gold highlight is nearly invisible on the light squares,
// because it differs from them in lightness only. These separate by hue as
// well, and each carries enough emissive to glow against either shade — the
// legal/capture greens and reds match the 2D board's indicators.
const SELECTED_SQUARE = 0xf6cc60;
const LEGAL_SQUARE = 0x2fb87f;
const CAPTURE_SQUARE = 0xd2543a;
const LAST_MOVE_SQUARE = 0xa9793c;
const CHECK_SQUARE = 0xc4402f;
const DROP_TARGET_SQUARE = 0xffe9a8;
// How far a dragged piece rises off the board, in board units.
const DRAG_LIFT_HEIGHT = 0.42;

const PIECE_PALETTE = {
    white: {
        body: 0xe7d5b6,
        accent: 0xc69447,
        shadow: 0x7d6849,
    },
    black: {
        body: 0x24231f,
        accent: 0xd1a052,
        shadow: 0x090907,
    },
};

function addVoxel(voxels, x, y, z, accent = false) {
    voxels.set(`${x}:${y}:${z}`, { x, y, z, accent });
}

function addDisk(voxels, y, radius, accent = false) {
    const limit = Math.ceil(radius);
    for (let x = -limit; x <= limit; x += 1) {
        for (let z = -limit; z <= limit; z += 1) {
            if ((x * x) + (z * z) <= (radius * radius) + 0.35) {
                addVoxel(voxels, x, y, z, accent);
            }
        }
    }
}

function addBox(voxels, y, minX, maxX, minZ, maxZ, accent = false) {
    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            addVoxel(voxels, x, y, z, accent);
        }
    }
}

function addEllipsoid(
    voxels,
    centerX,
    centerY,
    centerZ,
    radiusX,
    radiusY,
    radiusZ,
    accent = false,
) {
    for (
        let x = Math.floor(centerX - radiusX);
        x <= Math.ceil(centerX + radiusX);
        x += 1
    ) {
        for (
            let y = Math.floor(centerY - radiusY);
            y <= Math.ceil(centerY + radiusY);
            y += 1
        ) {
            for (
                let z = Math.floor(centerZ - radiusZ);
                z <= Math.ceil(centerZ + radiusZ);
                z += 1
            ) {
                const normalizedDistance = (
                    ((x - centerX) / radiusX) ** 2
                    + ((y - centerY) / radiusY) ** 2
                    + ((z - centerZ) / radiusZ) ** 2
                );
                if (normalizedDistance <= 1.08) {
                    addVoxel(voxels, x, y, z, accent);
                }
            }
        }
    }
}

function addCommonBase(voxels) {
    addDisk(voxels, 0, 3.15);
    addDisk(voxels, 1, 2.75);
    addDisk(voxels, 2, 2.25);
}

function buildPawnVoxels() {
    const voxels = new Map();
    const detail = VOXEL_DETAIL_SCALE;

    // A native micro-voxel pawn keeps every moulding crisp while giving the
    // head and stem a genuinely rounded silhouette at normal board scale.
    [
        [0, 2, 3.15],
        [3, 5, 2.95],
        [6, 7, 2.65],
        [8, 9, 2.9],
        [10, 11, 2.5],
    ].forEach(([startY, endY, radius]) => {
        for (let y = startY; y <= endY; y += 1) {
            addDisk(voxels, y, radius * detail);
        }
    });

    // The concave stem rises from a flared foot and opens again beneath the
    // capital, echoing a hand-turned classical wooden pawn.
    const stemProfile = [
        [14, 1.85],
        [18, 1.55],
        [21, 1.35],
        [24, 1.55],
    ];
    for (let y = 14; y <= 24; y += 1) {
        const upperIndex = Math.min(
            stemProfile.length - 1,
            Math.max(1, stemProfile.findIndex(layer => layer[0] >= y)),
        );
        const lower = stemProfile[upperIndex - 1];
        const upper = stemProfile[upperIndex];
        const progress = Math.max(
            0,
            Math.min(1, (y - lower[0]) / (upper[0] - lower[0])),
        );
        const radius = (
            lower[1] + ((upper[1] - lower[1]) * progress)
        ) * detail;
        addDisk(voxels, y, radius);
    }

    // Oversized rounded crown from the reference, supported by a projecting
    // capital and separated with a second contrasting collar.
    addEllipsoid(
        voxels,
        0, 36.25, 0,
        2.25 * detail, 2.2 * detail, 2.25 * detail,
    );
    addDisk(voxels, 25, 1.9 * detail);
    addDisk(voxels, 26, 2.15 * detail);
    addDisk(voxels, 27, 2.3 * detail);
    addDisk(voxels, 28, 2.05 * detail);

    for (let y = 12; y <= 13; y += 1) {
        addDisk(voxels, y, 2.55 * detail, true);
    }
    for (let y = 29; y <= 30; y += 1) {
        addDisk(voxels, y, 1.65 * detail, true);
    }

    return cullInteriorVoxels(voxels);
}

function buildRookVoxels() {
    const voxels = new Map();
    addCommonBase(voxels);
    addBox(voxels, 3, -2, 2, -2, 2);
    addBox(voxels, 4, -2, 2, -2, 2);
    addBox(voxels, 5, -2, 2, -2, 2);
    addBox(voxels, 6, -2, 2, -2, 2);
    addDisk(voxels, 7, 2.65, true);
    addBox(voxels, 8, -2, 2, -2, 2);

    const crenellations = [
        [-2, -2], [-1, -2], [1, -2], [2, -2],
        [-2, 2], [-1, 2], [1, 2], [2, 2],
        [-2, -1], [-2, 1], [2, -1], [2, 1],
    ];
    crenellations.forEach(([x, z]) => addVoxel(voxels, x, 9, z, true));
    return [...voxels.values()];
}

function buildKnightVoxels() {
    const voxels = new Map();
    const detail = VOXEL_DETAIL_SCALE;

    // Build the knight directly at final voxel resolution. Unlike the other
    // pieces, its curved animal silhouette benefits from smooth, native sampling
    // rather than enlarging a coarse block blueprint.
    [
        [0, 3, 3.15],
        [4, 7, 2.75],
        [8, 11, 2.25],
    ].forEach(([startY, endY, radius]) => {
        for (let y = startY; y <= endY; y += 1) {
            addDisk(voxels, y, radius * detail);
        }
    });

    // Contrasting collar above the pedestal.
    for (let y = 12; y <= 15; y += 1) {
        addDisk(voxels, y, 3.05 * detail, true);
    }

    // Broad chest tapering into an upright, arched neck. The layer profile is
    // interpolated at micro-voxel resolution for a continuous curve.
    const neckLayers = [
        [4, 0.0, 2.65, 2.35],
        [5, 0.45, 2.5, 2.2],
        [6, 0.8, 2.3, 2.05],
        [7, 1.0, 2.05, 1.9],
        [8, 0.9, 1.85, 1.8],
        [9, 0.65, 1.65, 1.7],
        [10, 0.35, 1.45, 1.55],
    ];
    for (let y = 16; y <= 43; y += 1) {
        const coarseY = y / detail;
        const matchingLayerIndex = neckLayers.findIndex(
            layer => layer[0] >= coarseY,
        );
        const upperIndex = Math.min(
            neckLayers.length - 1,
            Math.max(
                1,
                matchingLayerIndex === -1
                    ? neckLayers.length - 1
                    : matchingLayerIndex,
            ),
        );
        const lower = neckLayers[upperIndex - 1];
        const upper = neckLayers[upperIndex];
        const progress = Math.max(
            0,
            Math.min(1, (coarseY - lower[0]) / (upper[0] - lower[0])),
        );
        const centerX = (lower[1] + ((upper[1] - lower[1]) * progress)) * detail;
        const radiusX = (lower[2] + ((upper[2] - lower[2]) * progress)) * detail;
        const radiusZ = (lower[3] + ((upper[3] - lower[3]) * progress)) * detail;

        for (
            let x = Math.floor(centerX - radiusX);
            x <= Math.ceil(centerX + radiusX);
            x += 1
        ) {
            for (let z = -Math.ceil(radiusZ); z <= Math.ceil(radiusZ); z += 1) {
                const inside = (
                    ((x - centerX) / radiusX) ** 2
                    + (z / radiusZ) ** 2
                ) <= 1.08;
                if (inside) addVoxel(voxels, x, y, z);
            }
        }
    }

    // A horse reads by proportion, not detail: a deep round cheek at the back,
    // then a long muzzle stepping forward and down along a near-straight nose
    // bridge. A short snout on a round skull reads as a dog instead. The nose
    // stops at x = -6.8 so the piece still fits inside its square.
    addEllipsoid(
        voxels,
        -0.4 * detail, 8.7 * detail, 0,
        2.35 * detail, 2.55 * detail, 1.88 * detail,
    );
    addEllipsoid(
        voxels,
        -2.4 * detail, 8.5 * detail, 0,
        1.9 * detail, 1.5 * detail, 1.45 * detail,
    );
    addEllipsoid(
        voxels,
        -4.0 * detail, 8.0 * detail, 0,
        1.7 * detail, 1.25 * detail, 1.3 * detail,
    );
    addEllipsoid(
        voxels,
        -5.4 * detail, 7.5 * detail, 0,
        1.4 * detail, 1.05 * detail, 1.12 * detail,
    );
    // Jaw under the cheek, giving the head a defined underline.
    addEllipsoid(
        voxels,
        -2.1 * detail, 7.0 * detail, 0,
        1.85 * detail, 1.0 * detail, 1.4 * detail,
    );
    // Forehead and poll.
    addEllipsoid(
        voxels,
        0.1 * detail, 10.6 * detail, 0,
        1.75 * detail, 1.7 * detail, 1.6 * detail,
    );

    // Narrow upright ears set close together on the poll. The previous pair was
    // wide-set and broad, which is a canine cue.
    [-1, 1].forEach(side => {
        addEllipsoid(
            voxels,
            0.3 * detail,
            12.4 * detail,
            side * 0.95 * detail,
            0.45 * detail,
            2.0 * detail,
            0.42 * detail,
        );
        addEllipsoid(
            voxels,
            0.1 * detail,
            12.6 * detail,
            side * 0.97 * detail,
            0.16 * detail,
            1.15 * detail,
            0.16 * detail,
            true,
        );
    });

    // A contrasting mane follows the back of the neck and rolls over the poll.
    const manePath = [
        [4, 3], [5, 3], [6, 3.25], [7, 3.05],
        [8, 2.75], [9, 2.3], [10, 1.8], [11, 1.2], [12, 0.65],
    ];
    for (let index = 0; index < manePath.length - 1; index += 1) {
        const [startY, startX] = manePath[index];
        const [endY, endX] = manePath[index + 1];
        for (let y = startY * detail; y <= endY * detail; y += 1) {
            const progress = (y - (startY * detail)) / ((endY - startY) * detail);
            const x = Math.round(
                (startX + ((endX - startX) * progress)) * detail,
            );
            for (let offsetX = 0; offsetX <= 2; offsetX += 1) {
                for (let z = -2; z <= 2; z += 1) {
                    addVoxel(voxels, x + offsetX, y, z, true);
                }
            }
        }
    }
    addEllipsoid(
        voxels,
        -0.7 * detail, 11.0 * detail, 0,
        0.8 * detail, 0.65 * detail, 0.65 * detail,
        true,
    );

    // Small high-contrast facial marks give the horse expression at board scale.
    [-1, 1].forEach(side => {
        addEllipsoid(
            voxels,
            -1.0 * detail, 9.6 * detail, side * 1.72 * detail,
            0.28 * detail, 0.28 * detail, 0.16 * detail,
            true,
        );
        addEllipsoid(
            voxels,
            -6.3 * detail, 7.5 * detail, side * 0.8 * detail,
            0.32 * detail, 0.26 * detail, 0.2 * detail,
            true,
        );
        for (let x = -6.5 * detail; x <= -4.6 * detail; x += 1) {
            addVoxel(
                voxels,
                Math.round(x),
                Math.round(6.85 * detail),
                Math.round(side * 1.0 * detail),
                true,
            );
        }
    });

    return cullInteriorVoxels(voxels);
}

function buildBishopVoxels() {
    const voxels = new Map();
    const detail = VOXEL_DETAIL_SCALE;

    // Wide ceremonial foot with a contrasting foundation and progressively
    // tighter stepped mouldings.
    for (let y = 0; y <= 2; y += 1) {
        addDisk(voxels, y, 3.2 * detail, true);
    }
    [
        [3, 5, 3.1],
        [6, 8, 2.85],
        [9, 11, 2.6],
        [12, 14, 2.3],
        [15, 15, 2.05],
    ].forEach(([startY, endY, radius]) => {
        for (let y = startY; y <= endY; y += 1) {
            addDisk(voxels, y, radius * detail);
        }
    });

    // The stem is subtly concave with four proud ribs, giving the column the
    // vertical fluting visible in the reference from every angle.
    const stemProfile = [
        [16, 1.8],
        [21, 1.5],
        [25, 1.45],
        [29, 1.7],
    ];
    for (let y = 16; y <= 29; y += 1) {
        const upperIndex = Math.min(
            stemProfile.length - 1,
            Math.max(1, stemProfile.findIndex(layer => layer[0] >= y)),
        );
        const lower = stemProfile[upperIndex - 1];
        const upper = stemProfile[upperIndex];
        const progress = Math.max(
            0,
            Math.min(1, (y - lower[0]) / (upper[0] - lower[0])),
        );
        const radius = (
            lower[1] + ((upper[1] - lower[1]) * progress)
        ) * detail;
        addDisk(voxels, y, radius);

        const rib = Math.ceil(radius);
        for (let offset = -1; offset <= 1; offset += 1) {
            addVoxel(voxels, rib, y, offset);
            addVoxel(voxels, -rib, y, offset);
            addVoxel(voxels, offset, y, rib);
            addVoxel(voxels, offset, y, -rib);
        }
    }

    // Projecting capital and dark neck ring beneath the mitre.
    addDisk(voxels, 30, 1.95 * detail);
    addDisk(voxels, 31, 2.2 * detail);
    addDisk(voxels, 32, 2.4 * detail);
    addDisk(voxels, 33, 2.2 * detail);
    for (let y = 34; y <= 35; y += 1) {
        addDisk(voxels, y, 2.05 * detail, true);
    }

    // Layered egg-shaped mitre. Its changing profile creates the broad lower
    // lobes and pointed upper silhouette without scaling up coarse cubes.
    const mitreProfile = [
        [36, 1.5],
        [37, 1.85],
        [38, 2.05],
        [39, 2.15],
        [40, 2.2],
        [41, 2.2],
        [42, 2.1],
        [43, 1.95],
        [44, 1.75],
        [45, 1.55],
        [46, 1.3],
        [47, 1.05],
        [48, 0.8],
        [49, 0.6],
    ];
    mitreProfile.forEach(([y, radius]) => {
        addDisk(voxels, y, radius * detail);
    });

    // A true diagonal opening—not a painted stripe—cuts through the mitre and
    // reveals the dark board behind it as the camera orbits.
    [...voxels.entries()].forEach(([key, voxel]) => {
        if (voxel.y < 37 || voxel.y > 48) return;
        const slotCenterX = (43.5 - voxel.y) * 0.75;
        if (Math.abs(voxel.x - slotCenterX) <= 2.2) {
            voxels.delete(key);
        }
    });

    // Squared contrasting finial from the supplied multi-view design.
    addBox(voxels, 50, -3, 3, -3, 3, true);
    addBox(voxels, 51, -2, 2, -2, 2, true);

    return cullInteriorVoxels(voxels);
}

function buildQueenVoxels() {
    const voxels = new Map();

    // A wide, low plinth gives the otherwise slender queen a planted,
    // tournament-piece stance. The contrasting bottom course matches the
    // antique-gold foot in the supplied multi-view design.
    [
        [0, 1, 12.9, true],
        [2, 3, 12.6, false],
        [4, 5, 12.05, false],
        [6, 7, 11.35, false],
        [8, 9, 10.45, false],
        [10, 10, 9.45, false],
        [11, 11, 8.55, false],
    ].forEach(([startY, endY, radius, accent]) => {
        for (let y = startY; y <= endY; y += 1) {
            addDisk(voxels, y, radius, accent);
        }
    });

    // The long concave waist is the queen's defining proportion. Subtle body-
    // colored flutes preserve the clean dark-stone silhouette from every side.
    for (let y = 12; y <= 28; y += 1) {
        const lowerHalf = y <= 20;
        const radius = lowerHalf
            ? 7.65 - ((y - 12) * 0.36)
            : 4.77 + ((y - 20) * 0.22);
        addDisk(voxels, y, radius);

        const flute = Math.ceil(radius);
        addVoxel(voxels, flute, y, 0);
        addVoxel(voxels, -flute, y, 0);
        addVoxel(voxels, 0, y, flute);
        addVoxel(voxels, 0, y, -flute);
    }

    // A turned upper capital supports the crown and provides the strong gold
    // separator visible beneath it in the reference.
    [
        [29, 6.9, false],
        [30, 7.8, false],
        [31, 8.65, false],
        [32, 8.25, false],
        [33, 9.15, true],
        [34, 7.85, false],
        [35, 7.15, false],
    ].forEach(([y, radius, accent]) => {
        addDisk(voxels, y, radius, accent);
    });

    // The crown bowl is entirely contrasting material, making the queen
    // unmistakable even when viewed from across the board.
    [
        [36, 7.35],
        [37, 8.15],
        [38, 8.9],
        [39, 8.55],
    ].forEach(([y, radius]) => {
        addDisk(voxels, y, radius, true);
    });

    // Five curved crown arms radiate around the bowl. Each ends in a rounded
    // orb, matching the iconic five-point silhouette from the supplied top,
    // front, side, and rear views.
    const crownAngles = Array.from(
        { length: 5 },
        (_, index) => (Math.PI * 2 * index / 5) - (Math.PI / 2),
    );
    crownAngles.forEach((angle) => {
        for (let y = 38; y <= 44; y += 1) {
            const progress = (y - 38) / 6;
            const distance = 6.15 + (progress * 2.7);
            const centerX = Math.round(Math.cos(angle) * distance);
            const centerZ = Math.round(Math.sin(angle) * distance);

            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
                    if ((offsetX ** 2) + (offsetZ ** 2) <= 1.1) {
                        addVoxel(
                            voxels,
                            centerX + offsetX,
                            y,
                            centerZ + offsetZ,
                            true,
                        );
                    }
                }
            }
        }

        addEllipsoid(
            voxels,
            Math.round(Math.cos(angle) * 8.9),
            44.4,
            Math.round(Math.sin(angle) * 8.9),
            1.75,
            1.7,
            1.75,
            true,
        );
    });

    return cullInteriorVoxels(voxels);
}

function buildKingVoxels() {
    const voxels = new Map();

    // Broad, stepped octagonal plinth. The two contrasting lower courses give
    // the king the dark wooden footing seen in the supplied sculpture.
    [
        [0, 1, 13.4, true],
        [2, 3, 13.1, false],
        [4, 5, 12.5, false],
        [6, 7, 11.7, false],
        [8, 9, 10.8, false],
        [10, 10, 10.1, false],
        [11, 12, 10.7, true],
    ].forEach(([startY, endY, radius, accent]) => {
        for (let y = startY; y <= endY; y += 1) {
            addDisk(voxels, y, radius, accent);
        }
    });

    // A long fluted tower rises from the base. Four projecting buttresses make
    // the architecture legible from every camera angle instead of decorating
    // only a single "front" face.
    for (let y = 13; y <= 28; y += 1) {
        const lowerHalf = y <= 20;
        const radius = lowerHalf
            ? 8.35 - ((y - 13) * 0.34)
            : 5.97 + ((y - 20) * 0.2);
        addDisk(voxels, y, radius);

        const rib = Math.ceil(radius);
        for (let offset = -1; offset <= 1; offset += 1) {
            addVoxel(voxels, rib, y, offset, true);
            addVoxel(voxels, -rib, y, offset, true);
            addVoxel(voxels, offset, y, rib, true);
            addVoxel(voxels, offset, y, -rib, true);
        }
    }

    // Small heraldic medallions sit between the flutes on all four faces.
    // Their diamond profile keeps the detail readable at normal play distance.
    const medallionRows = [
        [18, 0],
        [19, 1],
        [20, 2],
        [21, 2],
        [22, 1],
        [23, 0],
    ];
    medallionRows.forEach(([y, halfWidth]) => {
        const bodyRadius = y <= 20
            ? 8.35 - ((y - 13) * 0.34)
            : 5.97 + ((y - 20) * 0.2);
        const face = Math.ceil(bodyRadius) + 1;
        for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
            addVoxel(voxels, offset, y, face, true);
            addVoxel(voxels, offset, y, -face, true);
            addVoxel(voxels, face, y, offset, true);
            addVoxel(voxels, -face, y, offset, true);
        }
    });

    // Layered shoulder armour bridges the narrow tower and the crown chamber.
    [
        [29, 7.6, true],
        [30, 9.15, false],
        [31, 10.1, false],
        [32, 9.45, false],
        [33, 8.25, true],
        [34, 7.05, true],
    ].forEach(([y, radius, accent]) => {
        addDisk(voxels, y, radius, accent);
    });

    // Crown chamber: a faceted royal orb with four contrasting vertical
    // panels. The changing radius creates the pronounced crown silhouette in
    // the reference without losing the cubic construction.
    const crownProfile = [
        [35, 6.5],
        [36, 7.4],
        [37, 8.35],
        [38, 9.05],
        [39, 9.35],
        [40, 9.05],
        [41, 8.45],
        [42, 7.55],
        [43, 6.45],
        [44, 5.45],
    ];
    crownProfile.forEach(([y, radius]) => {
        addDisk(voxels, y, radius);
        const panel = Math.ceil(radius);
        for (let offset = -1; offset <= 1; offset += 1) {
            addVoxel(voxels, panel, y, offset, true);
            addVoxel(voxels, -panel, y, offset, true);
            addVoxel(voxels, offset, y, panel, true);
            addVoxel(voxels, offset, y, -panel, true);
        }
    });

    // A substantial cross, viewed cleanly from either side, finishes the
    // sculpture. Its shallow depth keeps it crisp without becoming a cube.
    for (let y = 44; y <= 51; y += 1) {
        addBox(voxels, y, -1, 1, -1, 1, true);
    }
    for (let y = 47; y <= 49; y += 1) {
        addBox(voxels, y, -5, 5, -1, 1, true);
        addBox(voxels, y, -1, 1, -5, 5, true);
    }

    return cullInteriorVoxels(voxels);
}

function refineVoxelBlueprint(voxels, detailScale = VOXEL_DETAIL_SCALE) {
    if (detailScale <= 1) return voxels;

    const centerOffset = (detailScale - 1) / 2;
    const refined = new Map();

    voxels.forEach(voxel => {
        for (let subY = 0; subY < detailScale; subY += 1) {
            for (let subZ = 0; subZ < detailScale; subZ += 1) {
                for (let subX = 0; subX < detailScale; subX += 1) {
                    const detailVoxel = {
                        x: (voxel.x * detailScale) + subX - centerOffset,
                        y: (voxel.y * detailScale) + subY,
                        z: (voxel.z * detailScale) + subZ - centerOffset,
                        accent: voxel.accent,
                    };
                    refined.set(
                        `${detailVoxel.x}:${detailVoxel.y}:${detailVoxel.z}`,
                        detailVoxel,
                    );
                }
            }
        }
    });

    return cullInteriorVoxels(refined);
}

function cullInteriorVoxels(refined) {
    // Enclosed cubes can never contribute a visible face. Removing them keeps
    // the exterior detail while avoiding a large, invisible WebGL workload.
    const neighborOffsets = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
    ];
    return [...refined.values()].filter(voxel => (
        neighborOffsets.some(([offsetX, offsetY, offsetZ]) => (
            !refined.has(
                `${voxel.x + offsetX}:${voxel.y + offsetY}:${voxel.z + offsetZ}`,
            )
        ))
    ));
}

const BASE_VOXEL_BLUEPRINTS = {
    p: buildPawnVoxels(),
    r: buildRookVoxels(),
    n: buildKnightVoxels(),
    b: buildBishopVoxels(),
    q: buildQueenVoxels(),
    k: buildKingVoxels(),
};

const VOXEL_BLUEPRINTS = Object.fromEntries(
    Object.entries(BASE_VOXEL_BLUEPRINTS).map(([piece, voxels]) => (
        [piece, ['p', 'n', 'b', 'q', 'k'].includes(piece)
            ? voxels
            : refineVoxelBlueprint(voxels)]
    )),
);

// Relative heights from a traditional tournament Staunton set. Every sculpture
// is scaled uniformly, preserving its silhouette and cubic voxels while making
// the king-to-pawn hierarchy read like physical chess pieces.
const STAUNTON_HEIGHT_RATIOS = {
    k: 1,
    q: 0.9,
    b: 0.82,
    n: 0.75,
    r: 0.68,
    p: 0.53,
};

function blueprintHeight(voxels) {
    return Math.max(...voxels.map(voxel => voxel.y)) + 1;
}

const KING_BLUEPRINT_HEIGHT = blueprintHeight(VOXEL_BLUEPRINTS.k);
const PIECE_UNIFORM_SCALES = Object.fromEntries(
    Object.entries(VOXEL_BLUEPRINTS).map(([piece, voxels]) => [
        piece,
        (
            KING_BLUEPRINT_HEIGHT
            * STAUNTON_HEIGHT_RATIOS[piece]
            / blueprintHeight(voxels)
        ),
    ]),
);

function squarePosition(square) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return {
        x: (file - 3.5) * SQUARE_SIZE,
        z: (3.5 - rank) * SQUARE_SIZE,
    };
}

function makeLabelTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 128, 128);
    context.fillStyle = 'rgba(236, 216, 181, 0.92)';
    context.font = '600 55px Inter, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 66);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export class VoxelChessBoard {
    constructor({
        container,
        resetButton,
        onSquareSelect,
        onSquareDrop,
        onPieceGrab,
        canDragSquare,
    }) {
        if (!container) throw new Error('Voxel board container is missing.');

        this.container = container;
        this.resetButton = resetButton;
        this.onSquareSelect = onSquareSelect;
        this.onSquareDrop = onSquareDrop;
        this.onPieceGrab = onPieceGrab;
        this.canDragSquare = canDragSquare;
        this.humanColor = 'white';
        this.interactive = true;
        this.pointerStart = null;
        this.dragState = null;
        this.dragHoverSquare = null;
        this.squareMeshes = new Map();
        this.pieceGroups = new Map();
        this.pieceMeshes = [];
        this.pickables = [];
        this.lastHighlightState = {};
        this.active = false;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0c0a07, 0.027);

        this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 80);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.06;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.domElement.setAttribute('aria-hidden', 'true');
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.075;
        this.controls.enablePan = false;
        this.controls.enableZoom = true;
        this.controls.enableRotate = true;
        this.controls.zoomToCursor = true;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 24;
        this.controls.minPolarAngle = Math.PI * 0.18;
        this.controls.maxPolarAngle = Math.PI * 0.43;
        this.controls.rotateSpeed = 0.62;
        this.controls.zoomSpeed = 0.85;
        this.controls.target.set(0, 0.35, 0);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
        this.boardGroup = new THREE.Group();
        this.pieceGroup = new THREE.Group();
        this.boardGroup.add(this.pieceGroup);
        this.scene.add(this.boardGroup);

        this.createMaterials();
        this.createLights();
        this.createBoard();
        this.createCoordinateLabels();
        this.setPerspective('white', true);
        this.bindEvents();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resize();
    }

    createMaterials() {
        this.pieceMaterials = {};
        Object.entries(PIECE_PALETTE).forEach(([color, palette]) => {
            this.pieceMaterials[color] = {
                body: new THREE.MeshStandardMaterial({
                    color: palette.body,
                    roughness: color === 'white' ? 0.5 : 0.4,
                    metalness: color === 'white' ? 0.08 : 0.2,
                    flatShading: true,
                }),
                accent: new THREE.MeshStandardMaterial({
                    color: palette.accent,
                    roughness: 0.3,
                    metalness: 0.55,
                    flatShading: true,
                }),
            };
        });
    }

    createLights() {
        const hemisphere = new THREE.HemisphereLight(0xffe8c4, 0x25170e, 2.5);
        this.scene.add(hemisphere);

        const key = new THREE.DirectionalLight(0xffdfaa, 4.1);
        key.position.set(5.5, 11, 7);
        key.castShadow = true;
        key.shadow.mapSize.set(1536, 1536);
        key.shadow.camera.left = -7;
        key.shadow.camera.right = 7;
        key.shadow.camera.top = 7;
        key.shadow.camera.bottom = -7;
        key.shadow.camera.near = 2;
        key.shadow.camera.far = 28;
        key.shadow.bias = -0.00035;
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x9bb4cc, 1.1);
        fill.position.set(-7, 6, -5);
        this.scene.add(fill);

        const rim = new THREE.PointLight(0xd39b50, 28, 18, 2);
        rim.position.set(-4, 4, 3);
        this.scene.add(rim);
    }

    createBoard() {
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a2f1d,
            roughness: 0.58,
            metalness: 0.08,
        });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(8.72, 0.24, 8.72), frameMaterial);
        frame.position.y = -0.08;
        frame.castShadow = true;
        frame.receiveShadow = true;
        this.boardGroup.add(frame);

        const frameInset = new THREE.Mesh(
            new THREE.BoxGeometry(8.3, 0.12, 8.3),
            new THREE.MeshStandardMaterial({
                color: 0x24160e,
                roughness: 0.46,
                metalness: 0.16,
            }),
        );
        frameInset.position.y = 0.055;
        frameInset.receiveShadow = true;
        this.boardGroup.add(frameInset);

        const squareGeometry = new THREE.BoxGeometry(0.995, 0.14, 0.995);
        for (let rank = 0; rank < 8; rank += 1) {
            for (let file = 0; file < 8; file += 1) {
                const square = `${String.fromCharCode(97 + file)}${rank + 1}`;
                const isLight = (file + rank) % 2 === 1;
                const material = new THREE.MeshStandardMaterial({
                    color: isLight ? LIGHT_SQUARE : DARK_SQUARE,
                    roughness: 0.72,
                    metalness: 0.035,
                    emissive: 0x000000,
                    emissiveIntensity: 0,
                });
                const mesh = new THREE.Mesh(squareGeometry, material);
                const position = squarePosition(square);
                mesh.position.set(position.x, BOARD_TOP / 2, position.z);
                mesh.receiveShadow = true;
                mesh.userData.square = square;
                mesh.userData.baseColor = isLight ? LIGHT_SQUARE : DARK_SQUARE;
                this.boardGroup.add(mesh);
                this.squareMeshes.set(square, mesh);
                this.pickables.push(mesh);
            }
        }

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 40),
            new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.32 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.22;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    createCoordinateLabels() {
        const positions = [];
        for (let file = 0; file < 8; file += 1) {
            const x = file - 3.5;
            const label = String.fromCharCode(97 + file).toUpperCase();
            positions.push([label, x, 4.24], [label, x, -4.24]);
        }
        for (let rank = 0; rank < 8; rank += 1) {
            const z = 3.5 - rank;
            const label = String(rank + 1);
            positions.push([label, -4.24, z], [label, 4.24, z]);
        }

        positions.forEach(([label, x, z]) => {
            const material = new THREE.SpriteMaterial({
                map: makeLabelTexture(label),
                transparent: true,
                depthWrite: false,
                opacity: 0.78,
            });
            const sprite = new THREE.Sprite(material);
            sprite.position.set(x, 0.22, z);
            sprite.scale.set(0.22, 0.22, 0.22);
            this.boardGroup.add(sprite);
        });
    }

    createPieceMesh(symbol, color, square) {
        const type = symbol.toLowerCase();
        const blueprint = VOXEL_BLUEPRINTS[type] || VOXEL_BLUEPRINTS.p;
        const group = new THREE.Group();
        group.userData = { square, type, color };

        ['body', 'accent'].forEach((materialType) => {
            const voxels = blueprint.filter(voxel => (
                materialType === 'accent' ? voxel.accent : !voxel.accent
            ));
            if (voxels.length === 0) return;

            const mesh = new THREE.InstancedMesh(
                this.voxelGeometry,
                this.pieceMaterials[color][materialType],
                voxels.length,
            );
            const dummy = new THREE.Object3D();
            const variation = new THREE.Color();
            voxels.forEach((voxel, index) => {
                dummy.position.set(
                    voxel.x * VOXEL_STEP,
                    (voxel.y + 0.5) * VOXEL_STEP,
                    voxel.z * VOXEL_STEP,
                );
                dummy.rotation.set(0, 0, 0);
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                mesh.setMatrixAt(index, dummy.matrix);

                const base = PIECE_PALETTE[color][materialType];
                variation.setHex(base);
                const lift = ((voxel.x + voxel.y + voxel.z) % 4) * 0.012;
                variation.offsetHSL(0, 0, lift);
                mesh.setColorAt(index, variation);
            });
            mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.square = square;
            group.add(mesh);
            this.pieceMeshes.push(mesh);
            this.pickables.push(mesh);
        });

        if (type === 'n') {
            group.rotation.y = color === 'white' ? -Math.PI / 2 : Math.PI / 2;
        } else if (type === 'b') {
            group.rotation.y = Math.PI / 4;
        }

        group.scale.setScalar(PIECE_UNIFORM_SCALES[type] || 1);
        const position = squarePosition(square);
        group.position.set(position.x, BOARD_TOP, position.z);
        group.userData.square = square;
        group.userData.restingY = BOARD_TOP;
        return group;
    }

    createPawnCombatRig(color) {
        const rig = new THREE.Group();
        const bodyMaterial = this.pieceMaterials[color]?.body;
        const accentMaterial = this.pieceMaterials[color]?.accent;
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0xe5edf0,
            emissive: 0x70848d,
            emissiveIntensity: 0.18,
            roughness: 0.2,
            metalness: 0.96,
            flatShading: true,
        });

        const addChain = (
            parent,
            start,
            end,
            count,
            material,
            voxelScale = 1,
        ) => {
            for (let index = 0; index < count; index += 1) {
                const progress = count === 1 ? 0 : index / (count - 1);
                const cube = new THREE.Mesh(this.voxelGeometry, material);
                cube.position.set(
                    THREE.MathUtils.lerp(start[0], end[0], progress),
                    THREE.MathUtils.lerp(start[1], end[1], progress),
                    THREE.MathUtils.lerp(start[2], end[2], progress),
                );
                cube.scale.setScalar(voxelScale);
                cube.castShadow = true;
                parent.add(cube);
            }
        };

        // One balancing arm and one sword arm grow from the pawn's narrow stem.
        addChain(
            rig,
            [-0.1, 0.53, 0],
            [-0.29, 0.49, 0.12],
            9,
            bodyMaterial,
            1.55,
        );

        const swordArm = new THREE.Group();
        swordArm.position.set(0.1, 0.53, 0);
        addChain(
            swordArm,
            [0, 0, 0],
            [0.2, -0.04, 0.12],
            9,
            bodyMaterial,
            1.55,
        );
        addChain(
            swordArm,
            [0.13, -0.04, 0.12],
            [0.27, -0.04, 0.12],
            6,
            accentMaterial,
            1.5,
        );
        addChain(
            swordArm,
            [0.2, -0.01, 0.12],
            [0.2, 0.48, 0.12],
            21,
            bladeMaterial,
            1.35,
        );
        rig.add(swordArm);
        rig.userData.swordArm = swordArm;
        rig.userData.bladeMaterial = bladeMaterial;
        return rig;
    }

    async animatePawnCapture({
        fromSquare,
        toSquare,
        captureSquare,
        onImpact,
    } = {}) {
        if (!this.active) return false;

        const attacker = this.pieceGroup.children.find(piece => (
            piece.userData.square === fromSquare
            && piece.userData.type === 'p'
        ));
        const defender = this.pieceGroup.children.find(piece => (
            piece.userData.square === captureSquare
            && piece.userData.type === 'p'
        ));
        if (!attacker || !defender) return false;

        const startPosition = attacker.position.clone();
        const destination = squarePosition(toSquare);
        const targetPosition = new THREE.Vector3(
            destination.x,
            startPosition.y,
            destination.z,
        );
        const capturePosition = squarePosition(captureSquare);
        const defenderScale = defender.scale.clone();
        const defenderRotation = defender.rotation.clone();
        const rig = this.createPawnCombatRig(attacker.userData.color);
        const strikeDirection = new THREE.Vector2(
            capturePosition.x - startPosition.x,
            capturePosition.z - startPosition.z,
        );
        rig.rotation.y = Math.atan2(strikeDirection.x, strikeDirection.y);
        rig.scale.setScalar(0.001);
        attacker.add(rig);

        const flash = new THREE.PointLight(0xffd27c, 0, 3.2, 2);
        flash.position.set(capturePosition.x, 0.58, capturePosition.z);
        this.boardGroup.add(flash);

        const duration = 900;
        let impactPlayed = false;
        const startedAt = performance.now();

        try {
            await new Promise(resolve => {
                const step = now => {
                    const progress = Math.min(1, (now - startedAt) / duration);
                    const smooth = value => (
                        value * value * (3 - (2 * value))
                    );
                    const grow = smooth(Math.min(1, progress / 0.2));
                    const retreat = progress > 0.78
                        ? 1 - smooth((progress - 0.78) / 0.22)
                        : 1;
                    rig.scale.setScalar(Math.max(0.001, grow * retreat));

                    const lunge = progress < 0.55
                        ? smooth(progress / 0.55) * 0.72
                        : 0.72 + (smooth((progress - 0.55) / 0.45) * 0.28);
                    attacker.position.lerpVectors(
                        startPosition,
                        targetPosition,
                        lunge,
                    );

                    const swingProgress = Math.max(
                        0,
                        Math.min(1, (progress - 0.22) / 0.34),
                    );
                    rig.userData.swordArm.rotation.x = THREE.MathUtils.lerp(
                        -0.7,
                        1.7,
                        smooth(swingProgress),
                    );

                    if (progress >= 0.5 && !impactPlayed) {
                        impactPlayed = true;
                        flash.intensity = 18;
                        try {
                            onImpact?.();
                        } catch {
                            // Sound is optional; the visual strike still completes.
                        }
                    }

                    if (progress >= 0.5) {
                        const collapse = smooth(
                            Math.min(1, (progress - 0.5) / 0.34),
                        );
                        defender.scale.copy(defenderScale).multiplyScalar(
                            Math.max(0.04, 1 - collapse),
                        );
                        defender.rotation.z = (
                            defenderRotation.z + (collapse * 0.82)
                        );
                        flash.intensity = 18 * Math.max(
                            0,
                            1 - ((progress - 0.5) / 0.18),
                        );
                    }

                    if (progress < 1) {
                        requestAnimationFrame(step);
                    } else {
                        resolve();
                    }
                };
                requestAnimationFrame(step);
            });
        } finally {
            attacker.position.copy(startPosition);
            defender.scale.copy(defenderScale);
            defender.rotation.copy(defenderRotation);
            attacker.remove(rig);
            this.boardGroup.remove(flash);
            rig.userData.bladeMaterial.dispose();
        }

        return true;
    }

    sync({
        board,
        humanColor,
        selectedSquare,
        legalMoves,
        lastMove,
        checkSquare,
        interactive,
    }) {
        if (!board) return;
        if (humanColor && humanColor !== this.humanColor) {
            this.setPerspective(humanColor, true);
        }
        this.interactive = interactive !== false;

        this.pieceGroup.traverse((object) => {
            if (object.isInstancedMesh) object.dispose();
        });
        this.pieceGroup.clear();
        this.pickables = [...this.squareMeshes.values()];
        this.pieceMeshes = [];
        this.pieceGroups.clear();

        Object.entries(board).forEach(([square, pieceData]) => {
            const piece = this.createPieceMesh(
                pieceData.piece,
                pieceData.color,
                square,
            );
            this.pieceGroup.add(piece);
            this.pieceGroups.set(square, piece);
        });

        this.updateHighlights({
            selectedSquare,
            legalMoves,
            lastMove,
            checkSquare,
        });
    }

    updateHighlights({
        selectedSquare = null,
        legalMoves = [],
        lastMove = null,
        checkSquare = null,
    } = {}) {
        this.lastHighlightState = {
            selectedSquare,
            legalMoves,
            lastMove,
            checkSquare,
        };

        const lastFrom = lastMove?.slice(0, 2);
        const lastTo = lastMove?.slice(2, 4);
        const legalBySquare = new Map(legalMoves.map(move => [move.to, move]));

        this.squareMeshes.forEach((mesh, square) => {
            let color = mesh.userData.baseColor;
            let emissive = 0x000000;
            let intensity = 0;

            if (square === lastFrom || square === lastTo) {
                color = LAST_MOVE_SQUARE;
                emissive = 0x5a3a12;
                intensity = 0.24;
            }
            if (legalBySquare.has(square)) {
                const move = legalBySquare.get(square);
                color = move.capture ? CAPTURE_SQUARE : LEGAL_SQUARE;
                emissive = move.capture ? 0x7c1c13 : 0x146b47;
                intensity = 0.38;
            }
            if (square === selectedSquare) {
                color = SELECTED_SQUARE;
                emissive = 0xa8761a;
                intensity = 0.55;
            }
            if (square === checkSquare) {
                color = CHECK_SQUARE;
                emissive = 0x8e110b;
                intensity = 0.5;
            }
            if (square === this.dragHoverSquare) {
                color = DROP_TARGET_SQUARE;
                emissive = 0xc79a2e;
                intensity = 0.7;
            }

            mesh.material.color.setHex(color);
            mesh.material.emissive.setHex(emissive);
            mesh.material.emissiveIntensity = intensity;
        });
    }

    setPerspective(color, immediate = false) {
        this.humanColor = color;
        const direction = color === 'black' ? -1 : 1;
        const destination = new THREE.Vector3(8.4 * direction, 10.4, 12.2 * direction);

        if (immediate) {
            this.camera.position.copy(destination);
            this.controls.target.set(0, 0.35, 0);
            this.controls.update();
            this.controls.saveState();
            return;
        }

        this.camera.position.copy(destination);
        this.controls.target.set(0, 0.35, 0);
        this.controls.update();
    }

    resetView() {
        this.setPerspective(this.humanColor);
    }

    setInteractive(interactive) {
        this.interactive = Boolean(interactive);
        this.container.classList.toggle('board-locked', !this.interactive);
    }

    setActive(active) {
        const shouldRun = Boolean(active);
        if (shouldRun === this.active) return;
        this.active = shouldRun;

        if (this.active) {
            this.resize();
            this.animate();
        } else if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    bindEvents() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('pointerdown', (event) => {
            this.pointerStart = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now(),
            };

            // A press that lands on one of your own pieces starts a drag
            // instead of an orbit, so the same gesture cannot mean both.
            if (!this.interactive) return;
            const square = this.squareAtPointer(event);
            if (!square || !this.canDragSquare?.(square)) return;

            this.dragState = {
                pointerId: event.pointerId,
                fromSquare: square,
                dragging: false,
            };
            this.controls.enableRotate = false;
            try {
                canvas.setPointerCapture(event.pointerId);
            } catch {
                // Capture is an enhancement; the canvas still receives moves.
            }
        });

        canvas.addEventListener('pointermove', (event) => {
            if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
            if (!this.dragState.dragging) {
                const distance = Math.hypot(
                    event.clientX - this.pointerStart.x,
                    event.clientY - this.pointerStart.y,
                );
                if (distance < 7) return;
                this.dragState.dragging = true;
                this.liftDraggedPiece(this.dragState.fromSquare, true);
                this.container.classList.add('board-dragging');
                // Selecting on grab shows the legal squares underneath the
                // piece while it is still in the air.
                this.onPieceGrab?.(this.dragState.fromSquare);
            }

            const hovered = this.squareAtPointer(event);
            if (hovered !== this.dragHoverSquare) {
                this.dragHoverSquare = hovered;
                this.refreshHighlights();
            }
        });

        canvas.addEventListener('pointerup', (event) => {
            const drag = this.dragState;
            if (drag && event.pointerId === drag.pointerId) {
                this.endPieceDrag();
                if (drag.dragging) {
                    this.pointerStart = null;
                    const target = this.squareAtPointer(event);
                    if (target && target !== drag.fromSquare) {
                        this.onSquareDrop?.(drag.fromSquare, target);
                    }
                    return;
                }
            }

            if (!this.pointerStart || !this.interactive) return;
            const distance = Math.hypot(
                event.clientX - this.pointerStart.x,
                event.clientY - this.pointerStart.y,
            );
            const elapsed = performance.now() - this.pointerStart.time;
            this.pointerStart = null;
            if (distance > 7 || elapsed > 500) return;
            this.pickSquare(event);
        });

        canvas.addEventListener('pointercancel', () => {
            this.pointerStart = null;
            this.endPieceDrag();
        });

        this.resetButton?.addEventListener('click', () => this.resetView());
    }

    endPieceDrag() {
        if (!this.dragState) return;
        const { fromSquare } = this.dragState;
        this.dragState = null;
        this.controls.enableRotate = true;
        this.container.classList.remove('board-dragging');
        this.liftDraggedPiece(fromSquare, false);
        if (this.dragHoverSquare) {
            this.dragHoverSquare = null;
            this.refreshHighlights();
        }
    }

    // Raises the piece off the board while it is being dragged. This moves the
    // existing model; it does not alter the voxel geometry or materials.
    liftDraggedPiece(square, lifted) {
        const group = this.pieceGroups.get(square);
        if (!group) return;
        group.position.y = group.userData.restingY + (lifted ? DRAG_LIFT_HEIGHT : 0);
    }

    refreshHighlights() {
        this.updateHighlights(this.lastHighlightState);
    }

    squareAtPointer(event) {
        const bounds = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(this.pickables, false);
        return hits.find(hit => hit.object.userData.square)?.object.userData.square || null;
    }

    pickSquare(event) {
        const square = this.squareAtPointer(event);
        if (square) this.onSquareSelect?.(square);
    }

    resize() {
        const width = Math.max(1, this.container.clientWidth);
        const height = Math.max(1, this.container.clientHeight);
        // The denser 4× voxel field carries eight times the instances of the
        // previous revision, so cap Retina supersampling slightly lower to keep
        // orbiting and zooming responsive without changing model geometry.
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.1);
        const targetWidth = Math.floor(width * pixelRatio);
        const targetHeight = Math.floor(height * pixelRatio);

        if (
            this.renderer.domElement.width !== targetWidth
            || this.renderer.domElement.height !== targetHeight
        ) {
            this.renderer.setDrawingBufferSize(width, height, pixelRatio);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }

    animate() {
        if (!this.active) return;
        this.animationFrame = requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
