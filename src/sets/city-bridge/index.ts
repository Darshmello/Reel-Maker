// The approved M1 set: a city on a channel with a suspension bridge in the accent colour, a park
// on the near bank and a skyline across the bay. Adapts style/lowpoly/city.ts to the pack contract.
import type {SetPack} from '../types';
import {SERVER_LOT, SET, buildCity} from '../../style/lowpoly/city';

export const pack: SetPack = {
  hero: {x: -0.9, z: -1.0, yaw: 0.25},
  build: ({seed, accent, server, clear}) => {
    const c = buildCity({seed, accent, server, clear});
    return {
      group: c.group,
      local: c.local,
      toWorld: c.toWorld,
      landY: SET.landY,
      water: c.water,
      buildings: c.buildings,
      records: c.records,
      walk: c.walk,
      snow: [
        {x0: 0.95, x1: 40, z0: -260, z1: 3},
        {x0: -40, x1: -0.95, z0: -260, z1: 3},
        {x0: -90, x1: 90, z0: 85, z1: 215},
      ],
      lot: SERVER_LOT,
      // across the bay behind the bridge; never on a bank
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -13,
        ok: (v) => {
          const l = c.local.worldToLocal(v.clone());
          return l.z > SET.front + 0.6 || Math.abs(l.x) < SET.channel - 0.4;
        },
      },
    };
  },
};
