# ChurchFlow architecture

ChurchFlow is organized as a modular product rather than a page-by-page prototype.

## Stability boundaries

- `lib/churchflow.ts` is the domain and module registry. Navigation, permissions,
  labels and feature discovery are configured here.
- `app/api/*` is the public application boundary shared by web and mobile.
- `db/schema.ts` owns durable data contracts. Database changes require generated,
  reviewed migrations.
- `app/page.tsx` is the current web composition layer. As modules grow, each
  module moves to `app/(workspace)/<module>` without changing the domain types or
  API contracts.
- CSS design tokens in `app/globals.css` are the visual contract. Feature code
  uses semantic tokens instead of isolated colors.

## Extension rules

1. Add a module through the registry and give it an explicit permission.
2. Keep business rules out of visual components.
3. Version breaking API changes; prefer additive fields.
4. Generate and inspect a migration for every schema change.
5. Test desktop, tablet, mobile, keyboard navigation, loading, empty and error states.
6. Never expose financial, pastoral-care or administrator data without server-side authorization.

## Target package boundaries

Future development should evolve into:

- `packages/domain` — framework-independent types and validation
- `packages/design-system` — tokens and accessible components
- `apps/web` — administration and reporting
- `apps/mobile` — leaders, volunteers and members
- `services/api` — authorization and business workflows

The current API and domain registry are compatible with that migration path.
