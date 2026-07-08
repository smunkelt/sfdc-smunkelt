## Custom LWC Components

### Action Banner

A configurable, full-width banner panel for Salesforce Lightning pages. It displays a coloured bar containing an optional SLDS icon, up to two lines of text (with support for `{{FieldApiName}}` merge tokens on record pages), and up to two action buttons. Each button can invoke an autolaunched Flow, passing the current record's Id, and triggers an automatic LDS page refresh on completion. Fully configurable via Lightning App Builder and Flow Builder — no code required.

**Supported targets:** Record Page, App Page, Home Page, Screen Flow

[Full documentation →](https://smunkelt.github.io/sfdc-smunkelt/sfdcsm_actionBanner-documentation.html)

---

### Filtered Picklist

A reusable picklist component for Screen Flows and Lightning Record Pages that restricts available values to those permitted for a specific record type. Unlike a standard flow picklist, it respects record-type picklist filters. The record type can be supplied as a developer name (resolved to an ID via a cacheable Apex call) or directly as a Salesforce ID. It is flow-ready: it fires `FlowAttributeChangeEvent`, exposes a `value` output variable, and implements `validate()` to block navigation when the field is required but empty.

**Key inputs:** `objectApiName` (required), `fieldApiName` (required), `recordTypeName`, `label`, `required`, `includeNone`

[Full documentation →](https://smunkelt.github.io/sfdc-smunkelt/sfdcsm_filteredPicklist-documentation.html)

---

### Dynamic Related List

A configurable related-list component for Service Document templates that renders records dynamically using a relationship definition, optional source-link field path, configurable columns, sorting, and filter criteria. It includes built-in loading, empty, and error states, and formats Date/Time/DateTime values for user locale and timezone to improve readability in generated documents.

**Supported targets:** Service Document

[Full documentation →](https://smunkelt.github.io/sfdc-smunkelt/sfdcsm_dynamicRelatedList-documentation.html)
