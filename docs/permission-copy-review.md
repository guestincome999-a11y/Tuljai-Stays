# Permission Copy Review

## Owner App

| Permission    | Current Copy                                                                         | Status                                                |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Camera        | `Tuljai Stays Owner uses the camera to scan pilgrim QR passes for secure check-in.`  | Present in iOS config; Android permission present.    |
| Notifications | App asks through notification flow, but native store-facing copy needs final review. | Needs final store wording.                            |
| Vibration     | Android permission present for booking alerts.                                       | Document in Play Store data safety/permissions notes. |

## Pilgrim App

| Permission    | Current Copy                                                             | Status                                            |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Notifications | In-app copy explains booking accepted, QR ready, and checkout reminders. | Present in app UI; store copy needs final review. |
| Camera        | Not requested.                                                           | Correct for current app.                          |
| Location      | Not requested.                                                           | Correct for current app.                          |

## Required Before Store Submission

- Confirm Android notification permission behavior on target SDK.
- Confirm Play Store permission declarations match generated native manifests.
- Keep permission explanations short, accurate, and workflow-specific.
