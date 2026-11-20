import * as PlayFab from "./bindings/playfab.js";

export async function loginPlayFabWithSteam(ticket, screenName) {
  await PlayFab.LoginWithSteam(ticket);
  PlayFab.UpdateUserTitleDisplayName(screenName);
}
