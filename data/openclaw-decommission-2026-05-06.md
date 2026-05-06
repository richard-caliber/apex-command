# OpenClaw VM decommission — 2026-05-06

## STATUS: SURFACED, NOT EXECUTED

`gcloud` is not installed in the M6 working environment (Windows / Git Bash). Per M6 kill criteria + spec: surface to Ginge for manual action, do NOT attempt destructive cloud operations without verification.

## Manual steps for Ginge (run from a shell with gcloud auth)

```bash
# 1. List instances and disks in your GCP project
gcloud compute instances list --project=<PROJECT_ID>
gcloud compute disks list --project=<PROJECT_ID>

# 2. Identify the OpenClaw instance + disk(s) — likely something like:
#    instance: openclaw, openclaw-vm, claw, etc.
#    disk:     openclaw-disk, openclaw-vm, etc.
#    Confirm zone (likely europe-west2-* given UK base or us-central1-*).

# 3. Snapshot the disk(s) BEFORE deletion (keeps a recovery option)
gcloud compute disks snapshot <DISK_NAME> \
    --snapshot-names=openclaw-final-snapshot-2026-05-06 \
    --zone=<ZONE> \
    --project=<PROJECT_ID> \
    --description="Final snapshot before OpenClaw VM decommission. Apex Magnificent M6, 2026-05-06."

# 4. Delete the instance
gcloud compute instances delete <INSTANCE_NAME> \
    --zone=<ZONE> \
    --project=<PROJECT_ID> \
    --quiet

# 5. (Optional, after 30+ days if you don't need the snapshot) delete the snapshot too
#    gcloud compute snapshots delete openclaw-final-snapshot-2026-05-06 --project=<PROJECT_ID>

# 6. Verify billing has dropped (check GCP Console > Billing)
```

## Why this matters

- OpenClaw squad is dormant (M3.5 added the `dormant: true` flag; squad agents return the dormant-stub current_task in briefings).
- Phase 7 will rebuild the squad as Newton + Darwin Claude Projects, NOT as OpenClaw VMs.
- The VM is therefore terminally unused — every hour it runs is wasted spend.
- The snapshot preserves the agent workspace files, soul backups, etc. in case Phase 7 needs reference material.

## Recovery

If Phase 7 work needs OpenClaw state:
- Restore the snapshot to a new disk/instance
- Or extract files via `gcloud compute scp` after re-attaching the disk to a temporary VM.

## Once Ginge confirms decommission

After Ginge runs the steps and snapshot ID is captured:
1. Edit this file with the actual snapshot identifier
2. Edit `apex:practices:v1` entry `manual-c67954b3-52b4-4a9c-90e4-003238bdfcb7` (Apex Magnificent backlog) to mark "Decommission OpenClaw VM" as done
3. Update `data/magnificent-log.md` M6 entry to confirm decommission complete
