# Publication privacy

This repository was assembled as new source in a fresh Git repository, separately from the reference TV's private working files. No old project history was imported.

The public compatibility profile contains only a model number, software versions, known system app/service names, documented IP range constants and firmware-file hashes. It excludes individual device identifiers, country/account settings, network details and captured TV files. Examples use an SSH alias, not a real address.

The public repository owner's GitHub handle is necessarily visible. Commits use that public handle and its ID-based GitHub noreply address rather than a personal name/email. The numeric account ID and handle are public GitHub metadata, not TV identifiers. Attribution was corrected from an initial shared generic identity at the owner's request.

## Local state

The client creates ignored `.private/` data with restrictive permissions. This includes the SSH alias, audited settings, plan, error diagnostics and downloaded rollback archive. It does not copy SSH keys. The TV's root-only state/backups can contain private configuration; never publish them. Only the network guard code and the directories needed for ConnMan traversal are made readable to its service user.

The toolkit has no analytics endpoint and makes no requests to this project. It invokes the TV's own local APIs and SSH. Its status check uses a route lookup for a public test destination, not an application-layer request.

## Before any push

Run `python3 tools/privacy.py`. It scans Git's staged contents and every reachable commit, including author/committer metadata and commit messages. The check rejects common secret formats, MAC addresses, unexpected IP/email addresses, private/generated paths, binary assets and non-regular Git entries. A small allowlist permits only the IP range constants and public route-test destination actually required by the network script.

For additional assurance, prepare a private file outside this repository containing one known sensitive value per line, then pass `--deny-file` with its path. Keep the file private. Findings print only the affected public path and category, never the matching value. Review the staged diff and history yourself as well; arbitrary names, tokens or encodings cannot all be recognized automatically.

For issues, describe only the model/firmware and the names of failing checks. Do not attach complete audits, settings, screenshots, logs, archives, SSH configurations or connection transcripts. Report a suspected credential leak through GitHub's private security reporting feature when available, without first posting the secret publicly.
