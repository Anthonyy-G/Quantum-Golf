export interface AABB {
  min: [number, number, number];
  max: [number, number, number];
}

export function getAABB(
  position: [number, number, number],
  size: [number, number, number]
): AABB {
  return {
    min: [position[0] - size[0] / 2, position[1] - size[1] / 2, position[2] - size[2] / 2],
    max: [position[0] + size[0] / 2, position[1] + size[1] / 2, position[2] + size[2] / 2],
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min[0] < b.max[0] && a.max[0] > b.min[0] &&
    a.min[1] < b.max[1] && a.max[1] > b.min[1] &&
    a.min[2] < b.max[2] && a.max[2] > b.min[2]
  );
}

export function resolveAABBCollision(
  ballPos: [number, number, number],
  ballVel: [number, number, number],
  ballRadius: number,
  boxAABB: AABB,
  restitution: number = 0.55
): { pos: [number, number, number]; vel: [number, number, number] } | null {
  const ballAABB: AABB = {
    min: [ballPos[0] - ballRadius, ballPos[1] - ballRadius, ballPos[2] - ballRadius],
    max: [ballPos[0] + ballRadius, ballPos[1] + ballRadius, ballPos[2] + ballRadius],
  };

  if (!aabbOverlap(ballAABB, boxAABB)) return null;

  // Find penetration on each axis
  const overlapX = Math.min(ballAABB.max[0] - boxAABB.min[0], boxAABB.max[0] - ballAABB.min[0]);
  const overlapY = Math.min(ballAABB.max[1] - boxAABB.min[1], boxAABB.max[1] - ballAABB.min[1]);
  const overlapZ = Math.min(ballAABB.max[2] - boxAABB.min[2], boxAABB.max[2] - ballAABB.min[2]);

  // Resolve along smallest penetration axis (surface normal)
  const newPos: [number, number, number] = [...ballPos];
  const newVel: [number, number, number] = [...ballVel];

  if (overlapX <= overlapY && overlapX <= overlapZ) {
    // X normal
    const sign = ballPos[0] < (boxAABB.min[0] + boxAABB.max[0]) / 2 ? -1 : 1;
    newPos[0] = ballPos[0] + sign * overlapX;
    newVel[0] = -newVel[0] * restitution;
    newVel[1] *= 0.98;
    newVel[2] *= 0.98;
  } else if (overlapY <= overlapX && overlapY <= overlapZ) {
    // Y normal (floor/ceiling)
    const sign = ballPos[1] < (boxAABB.min[1] + boxAABB.max[1]) / 2 ? -1 : 1;
    newPos[1] = ballPos[1] + sign * overlapY;
    newVel[1] = -newVel[1] * restitution;
    newVel[0] *= 0.88;
    newVel[2] *= 0.88;
  } else {
    // Z normal
    const sign = ballPos[2] < (boxAABB.min[2] + boxAABB.max[2]) / 2 ? -1 : 1;
    newPos[2] = ballPos[2] + sign * overlapZ;
    newVel[2] = -newVel[2] * restitution;
    newVel[0] *= 0.98;
    newVel[1] *= 0.98;
  }

  return { pos: newPos, vel: newVel };
}

export function stepBall(
  pos: [number, number, number],
  vel: [number, number, number],
  dt: number,
  gravity: [number, number, number],
  platforms: Array<{ position: [number, number, number]; size: [number, number, number] }>,
  walls: Array<{ position: [number, number, number]; size: [number, number, number] }>,
  obstacles: Array<{ position: [number, number, number]; size: [number, number, number] }>,
  restitution: number = 0.55
): { pos: [number, number, number]; vel: [number, number, number] } {
  const BALL_RADIUS = 0.22;
  const SUB_STEPS = 4;
  const subDt = dt / SUB_STEPS;

  let p: [number, number, number] = [...pos];
  let v: [number, number, number] = [...vel];

  for (let s = 0; s < SUB_STEPS; s++) {
    // Integrate velocity
    v[0] += gravity[0] * subDt;
    v[1] += gravity[1] * subDt;
    v[2] += gravity[2] * subDt;

    // Integrate position
    p[0] += v[0] * subDt;
    p[1] += v[1] * subDt;
    p[2] += v[2] * subDt;

    // Collide with platforms (high restitution for floor)
    for (const platform of platforms) {
      const aabb = getAABB(platform.position, platform.size);
      const res = resolveAABBCollision(p, v, BALL_RADIUS, aabb, restitution * 0.6);
      if (res) {
        p = res.pos;
        v = res.vel;
      }
    }

    // Collide with walls
    for (const wall of walls) {
      const aabb = getAABB(wall.position, wall.size);
      const res = resolveAABBCollision(p, v, BALL_RADIUS, aabb, restitution);
      if (res) {
        p = res.pos;
        v = res.vel;
      }
    }

    // Collide with obstacles
    for (const obs of obstacles) {
      const aabb = getAABB(obs.position, obs.size);
      const res = resolveAABBCollision(p, v, BALL_RADIUS, aabb, restitution * 1.2);
      if (res) {
        p = res.pos;
        v = res.vel;
      }
    }
  }

  return { pos: p, vel: v };
}

export function isNearHole(
  ballPos: [number, number, number],
  holePos: [number, number, number],
  threshold = 0.45
): boolean {
  const dx = ballPos[0] - holePos[0];
  const dy = ballPos[1] - holePos[1];
  const dz = ballPos[2] - holePos[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < threshold;
}

export function isBallStopped(vel: [number, number, number]): boolean {
  const speed = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
  return speed < 0.04;
}

export function isBallFallen(pos: [number, number, number]): boolean {
  return pos[1] < -8;
}
