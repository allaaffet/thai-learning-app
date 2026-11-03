import { getJourneyScene as getCityJourneyScene } from "@/data/romance-journey";
import { getCampusJourneyScene } from "@/data/romance-campus";
import type { RomanceSetting } from "@/lib/romance-setting";

export function getStoryJourneyScene(
  characterId: string,
  episodeId: string,
  setting: RomanceSetting = "city",
) {
  return setting === "campus"
    ? getCampusJourneyScene(characterId, episodeId)
    : getCityJourneyScene(characterId, episodeId);
}

export function getStoryJourneyRoute(
  characterId: string,
  episodeId: string,
  routeId: string,
  setting: RomanceSetting = "city",
) {
  return getStoryJourneyScene(characterId, episodeId, setting)?.routes.find(
    (route) => route.id === routeId,
  );
}
