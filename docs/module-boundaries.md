# Module Boundaries

## Current Foundation

The repository currently provides infrastructure and application foundations only. It does not include booking, QR, notification workflow, payment, listing, room, or review business logic.

## Future Backend Module Shape

Each backend feature should use this structure:

- `domain` for entities, value objects, and policy logic.
- `application` for use cases and orchestration.
- `infrastructure` for Prisma repositories and external providers.
- `presentation` for controllers, DTOs, and gateways.

NestJS modules may group these folders under a feature module when that keeps ownership clear.

## Future App Module Shape

Each app feature should keep UI components thin:

- screen components handle layout and user interaction.
- hooks coordinate view state and API calls.
- services use `@tuljai/shared` API clients.
- business rules live outside UI components.
