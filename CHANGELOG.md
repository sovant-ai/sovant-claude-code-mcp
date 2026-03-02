# Changelog

## 0.3.0

- **Dev-only isolation by default.** `sovant_recall` now sends `space=dev`, returning only memories tagged `source:claude-code`. Dashboard, CRM, and smart-capture memories are excluded unless `include_workspace=true` is passed.
- **New recall parameters:** `scope` (thread/global), `mode` (smart/exact), `debug` (bool), `include_workspace` (bool).
- **Debug output.** Pass `debug=true` to append token estimates, source/type counts, and recall metadata.
- Updated README with privacy default section and recall parameter table.

## 0.2.0

- Initial public release.
- Tools: `sovant_remember`, `sovant_remember_pref`, `sovant_remember_decision`, `sovant_recall`, `sovant_search`, `sovant_memory_list`, `sovant_memory_show`, `sovant_memory_update`, `sovant_memory_delete`, `sovant_thread_info`.
- Thread-per-repo mapping via `.sovant/thread.json`.
- Session-start recall for automatic project context loading.
