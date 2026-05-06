# Image Gen Verification — 2026-05-06

## Local file presence (all 11)

| Project | Local file | Size |
|---|---|---|
| atlas-drift | `/public/images/atlas-drift-card.jpg` | 437 KB |
| poker-os | `/public/images/poker-os-card.jpg` | 710 KB |
| todd-saifent | `/public/images/todd-saifent-card.jpg` | 582 KB |
| sheils-poker | `/public/images/sheils-poker-card.jpg` | 591 KB |
| bracelet-quest | `/public/images/bracelet-quest-card.jpg` | 496 KB |
| pokemon-fusion | `/public/images/pokemon-fusion-card.jpg` | 688 KB |
| personal-tv-script | `/public/images/personal-tv-script-card.jpg` | 636 KB |
| personal-rms | `/public/images/personal-rms-card.jpg` | 489 KB |
| snap-apps | `/public/images/snap-apps-card.jpg` | 612 KB |
| ideas-vault | `/public/images/ideas-vault-card.jpg` | 609 KB |
| personal | `/public/images/personal-card.jpg` | 1.0 MB |

## image_url updates applied (all 11)

Every record returned from apex_set_project showed:
- `image_url: "/images/{project-id}-card.jpg"` correctly set
- All status/stage/blocker/tags fields preserved (no field-omission corruption)

## Production verification — WAITING ON DEPLOY

Pre-deploy curl probe (2026-05-06):
- All 11 image URLs return HTTP 404 on https://apex-command-seven.vercel.app
- Baseline confirmed: `caliber-card.jpg` (existing image) returns HTTP 200 from same path

Reason: image files exist locally only; commit + push to master is required for Vercel to rebuild and serve them. The DB updates (image_url field) are already live, so the cards will reference the URLs as soon as Vercel ships the new build.

## Per-project verification

| Project | DB image_url set | Local file present | Production URL serves |
|---|---|---|---|
| atlas-drift | ✓ | ✓ | pending deploy |
| poker-os | ✓ | ✓ | pending deploy |
| todd-saifent | ✓ | ✓ | pending deploy |
| sheils-poker | ✓ | ✓ | pending deploy |
| bracelet-quest | ✓ | ✓ | pending deploy |
| pokemon-fusion | ✓ | ✓ | pending deploy |
| personal-tv-script | ✓ | ✓ | pending deploy |
| personal-rms | ✓ | ✓ | pending deploy |
| snap-apps | ✓ | ✓ | pending deploy |
| ideas-vault | ✓ | ✓ | pending deploy |
| personal | ✓ | ✓ | pending deploy |

## Status

DB and local artifacts complete. Commit + push to master blocked by harness permission policy (master is protected). User approval required to ship.

## Quality concerns for Ginge to review

- All 11 images match the established War Room style (deep black bg, single dominant subject, painterly with soft inner glow, single accent colour). Visually consistent with caliber/gemsnap/parliament/storyquest/edgeauto cards.
- Two stylistic outliers worth noting:
  - `pokemon-fusion`: came back as an abstract creature-vortex rather than two literal creatures merging — still on-brand atmospherically but more abstract than the prompt requested. Acceptable given the project is archived/creative-track.
  - `personal-card`: leans more "cosmic/painterly" (visible canvas texture) than the cleaner illustrative style of others. Could be regenerated for tighter consistency if Ginge wants.
- All others read as cohesive with the existing card set.
