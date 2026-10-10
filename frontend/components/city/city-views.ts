import { Vector3 } from "three";

/**
 * Where one can stand in the scene. The skyline circles the Petronas Twin
 * Towers from the air; the other two stand still and only look around, the
 * way one would in Bukit Bintang or on Menara KL's deck.
 *
 * Positions are metres from the towers, x east and z south.
 */

export type ViewKey = "skyline" | "street" | "deck";

export interface View {
  label: string;
  position: Vector3;
  /** What the view first looks at. A standing view looks around its own position. */
  lookAt: Vector3;
  standing: boolean;
}

const TOWERS_MIDWAY = new Vector3(0, 220, 0);

export const VIEWS: Record<ViewKey, View> = {
  skyline: { label: "Skyline", position: new Vector3(1250, 480, 1150), lookAt: new Vector3(-150, 120, 150), standing: false },
  // Jalan Bukit Bintang at Jalan Sultan Ismail, about 1.2 km south of the towers.
  street: { label: "Bukit Bintang", position: new Vector3(-72, 1.7, 1244), lookAt: TOWERS_MIDWAY, standing: true },
  // Menara KL's Sky Deck, 300 m up, at the turret's window facing the towers 1 km north-east.
  deck: { label: "KL Tower deck", position: new Vector3(-856, 300, 539), lookAt: TOWERS_MIDWAY, standing: true },
};

export const VIEW_KEYS = Object.keys(VIEWS) as ViewKey[];
