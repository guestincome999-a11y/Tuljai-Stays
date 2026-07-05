# Production App Configuration Review

## Pilgrim App

| Item            | Current Value                 | Status                                                      |
| --------------- | ----------------------------- | ----------------------------------------------------------- |
| Display name    | Tuljai Stays                  | Ready                                                       |
| Slug            | `tuljai-stays-pilgrim`        | Ready                                                       |
| Version         | `0.1.0`                       | Release candidate value; update for store release if needed |
| Android package | `com.tuljaistays.pilgrim`     | Ready                                                       |
| iOS bundle ID   | `com.tuljaistays.pilgrim`     | Ready                                                       |
| Schemes         | `tuljai-stays`, `tuljaistays` | Ready                                                       |
| API base URL    | `EXPO_PUBLIC_API_BASE_URL`    | Ready; must be production HTTPS for release                 |
| Icons/splash    | Not committed                 | Missing final assets                                        |

## Owner App

| Item              | Current Value              | Status                                                      |
| ----------------- | -------------------------- | ----------------------------------------------------------- |
| Display name      | Tuljai Stays Owner         | Ready                                                       |
| Slug              | `tuljai-stays-owner`       | Ready                                                       |
| Version           | `0.1.0`                    | Release candidate value; update for store release if needed |
| Android package   | `com.tuljaistays.owner`    | Ready                                                       |
| iOS bundle ID     | `com.tuljaistays.owner`    | Ready                                                       |
| Scheme            | `tuljaistays-owner`        | Ready                                                       |
| API base URL      | `EXPO_PUBLIC_API_BASE_URL` | Ready; must be production HTTPS for release                 |
| Camera permission | Present                    | Ready for QR scan                                           |
| Icons/splash      | Not committed              | Missing final assets                                        |

## Admin Panel

| Item         | Current Value                               | Status                                  |
| ------------ | ------------------------------------------- | --------------------------------------- |
| Title        | Tuljai Stays Admin                          | Ready                                   |
| Description  | Administration foundation for Tuljai Stays. | Needs marketing/legal review if public  |
| Favicon      | Not found                                   | Missing                                 |
| API base URL | `NEXT_PUBLIC_API_BASE_URL`                  | Ready; must point to production backend |
