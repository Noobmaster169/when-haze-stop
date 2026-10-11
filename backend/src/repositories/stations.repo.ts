import type { Network, Station } from "../contracts";
import type { Queryable } from "../db";

/** The stations of both networks, each with its newest reading. */

export interface NewStation {
  id: string;
  name: string;
  state: string;
  stateId: number;
  network: Network;
  lat: number;
  lon: number;
}

interface StationRow {
  id: string;
  name: string;
  state: string;
  state_id: number;
  network: Network;
  lat: number;
  lon: number;
  api: number | null;
  observed_at: Date | null;
}

const WITH_LATEST = `
  select s.id, s.name, s.state, s.state_id, s.network, s.lat, s.lon, r.api, r.observed_at
    from stations s
    left join lateral (
      select api, observed_at from readings where station_id = s.id order by observed_at desc limit 1
    ) r on true`;

function toStation(row: StationRow): Station {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    network: row.network,
    lat: row.lat,
    lon: row.lon,
    api: row.api,
    observedAt: row.observed_at ? row.observed_at.toISOString() : null,
  };
}

/** DOE moves and renames stations now and then; a network's newest word on one of its stations replaces the last. */
export async function upsertMany(db: Queryable, stations: NewStation[]): Promise<void> {
  if (stations.length === 0) return;
  await db.query(
    `insert into stations (id, name, state, state_id, network, lat, lon)
     select * from unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::text[], $6::float8[], $7::float8[])
     on conflict (id) do update
       set name = excluded.name, state = excluded.state, state_id = excluded.state_id, network = excluded.network,
           lat = excluded.lat, lon = excluded.lon, updated_at = now()`,
    [
      stations.map((station) => station.id),
      stations.map((station) => station.name),
      stations.map((station) => station.state),
      stations.map((station) => station.stateId),
      stations.map((station) => station.network),
      stations.map((station) => station.lat),
      stations.map((station) => station.lon),
    ],
  );
}

export async function list(db: Queryable): Promise<Station[]> {
  const { rows } = await db.query<StationRow>(`${WITH_LATEST} order by s.state, s.name`);
  return rows.map(toStation);
}

export async function find(db: Queryable, id: string): Promise<Station | null> {
  const { rows } = await db.query<StationRow>(`${WITH_LATEST} where s.id = $1`, [id]);
  return rows[0] ? toStation(rows[0]) : null;
}

/** The DOE state ids that have a station, which is what the hourly table is asked by. */
export async function stateIds(db: Queryable): Promise<number[]> {
  const { rows } = await db.query<{ state_id: number }>("select distinct state_id from stations where network = 'doe' order by state_id");
  return rows.map((row) => row.state_id);
}
