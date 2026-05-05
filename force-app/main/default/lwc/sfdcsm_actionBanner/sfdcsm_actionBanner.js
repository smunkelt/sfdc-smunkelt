import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, getFieldValue, getRecordNotifyChange } from 'lightning/uiRecordApi';
import invokeFlow from '@salesforce/apex/sfdcsm_ActionBannerFlowController.invokeFlow';

const DEFAULT_COLOR = '#4CAF50';
const VALID_ALIGNMENTS = ['left', 'center', 'right'];
const VALID_BUTTON_VARIANTS = [
    'bare', 'neutral', 'brand', 'brand-outline',
    'inverse', 'destructive', 'destructive-text', 'success'
];

// Matches {{FieldApiName}} tokens, e.g. {{Subject}} or {{SLA_Status__c}}
// Double-brace syntax avoids Lightning App Builder's {!...} expression validator.
const MERGE_FIELD_PATTERN = /\{\{(\w+)\}\}/g;

export default class Sfdcsm_actionBanner extends LightningElement {

    // ─── Record context ───────────────────────────────────────────────────────

    /** Auto-bound on record pages; pass explicitly in screen flows. */
    @api recordId;

    /**
     * Auto-bound on record pages by the platform.
     * Needed to qualify merge-field tokens with the correct object prefix.
     */
    _objectApiName;
    @api
    get objectApiName() { return this._objectApiName; }
    set objectApiName(value) {
        this._objectApiName = value;
        this._computeFields();
    }

    // ─── Appearance ───────────────────────────────────────────────────────────

    /** Panel background colour as a hex code, e.g. "#4CAF50" */
    @api panelColor = DEFAULT_COLOR;

    /** Text colour as a hex code, e.g. "#ffffff". Defaults to white. */
    @api textColor = '#ffffff';

    /** SLDS icon name, e.g. "standard:account" or "utility:info" */
    @api iconName;

    // ─── Text (with optional merge-field support) ─────────────────────────────

    /**
     * Primary (bold) text line.
     * Supports {{FieldApiName}} tokens on record pages, e.g.:
     *   "SLA Breached · {{SLA_Remaining__c}} overdue"
     *   "{{Name}}"
     */
    _textLine1;
    @api
    get textLine1() { return this._textLine1; }
    set textLine1(value) {
        this._textLine1 = value;
        this._computeFields();
    }

    /**
     * Secondary (lighter) text line.
     * Supports the same {{FieldApiName}} token syntax as textLine1.
     */
    _textLine2;
    @api
    get textLine2() { return this._textLine2; }
    set textLine2(value) {
        this._textLine2 = value;
        this._computeFields();
    }

    /** Text alignment: "left" | "center" | "right" */
    @api textAlignment = 'left';

    // ─── Buttons ──────────────────────────────────────────────────────────────

    @api button1Label;
    @api button1Variant = 'neutral';
    @api button1Flow;

    @api button2Label;
    @api button2Variant = 'neutral';
    @api button2Flow;

    // ─── Internal state ───────────────────────────────────────────────────────

    @track isLoading = false;

    /**
     * Fully-qualified field names extracted from merge tokens, e.g.
     * ["Case.Subject", "Case.SLA_Remaining__c"].
     * Reactive – changes here trigger the getRecord wire to re-fetch.
     */
    @track _dynamicFields = [];

    /** Raw wired record returned by LDS. */
    _record;

    // ─── Wire ─────────────────────────────────────────────────────────────────

    @wire(getRecord, { recordId: '$recordId', fields: '$_dynamicFields' })
    _wiredRecord({ data, error }) {
        if (data) {
            this._record = data;
        }
        // Silently ignore errors – a field name typo should not break the panel
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    connectedCallback() {
        // Run once all @api properties have been set by the platform/parent
        this._computeFields();
    }

    // ─── Resolved text getters ────────────────────────────────────────────────

    get resolvedTextLine1() {
        return this._resolveText(this._textLine1);
    }

    get resolvedTextLine2() {
        return this._resolveText(this._textLine2);
    }

    // ─── Other derived properties ─────────────────────────────────────────────

    get panelStyle() {
        const colour = this.panelColor?.trim() || DEFAULT_COLOR;
        return `background-color: ${colour};`;
    }

    get textStyle() {
        const colour = this.textColor?.trim() || '#ffffff';
        return `color: ${colour};`;
    }

    get showIcon() {
        return !!this.iconName?.trim();
    }

    get showButtons() {
        return !!(this.button1Label?.trim() || this.button2Label?.trim());
    }

    get resolvedButton1Variant() {
        const v = this.button1Variant?.trim().toLowerCase();
        return VALID_BUTTON_VARIANTS.includes(v) ? v : 'neutral';
    }

    get resolvedButton2Variant() {
        const v = this.button2Variant?.trim().toLowerCase();
        return VALID_BUTTON_VARIANTS.includes(v) ? v : 'neutral';
    }

    get resolvedAlignment() {
        const align = this.textAlignment?.trim().toLowerCase();
        return VALID_ALIGNMENTS.includes(align) ? align : 'left';
    }

    get textContainerClass() {
        return `panel__text-container slds-text-align_${this.resolvedAlignment}`;
    }

    // ─── Button handlers ──────────────────────────────────────────────────────

    handleButton1Click() {
        this._runFlow(this.button1Flow);
    }

    handleButton2Click() {
        this._runFlow(this.button2Flow);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Scans textLine1 and textLine2 for {{FieldApiName}} tokens and builds the
     * list of fully-qualified field names the wire adapter needs to fetch.
     * Called whenever a relevant @api property changes.
     */
    _computeFields() {
        if (!this._objectApiName) return;

        const fields = new Set();
        for (const text of [this._textLine1, this._textLine2]) {
            if (!text?.includes('{{')) continue;
            const regex = new RegExp(MERGE_FIELD_PATTERN.source, 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                fields.add(`${this._objectApiName}.${match[1]}`);
            }
        }
        this._dynamicFields = [...fields];
    }

    /**
     * Replaces {{FieldApiName}} tokens in a template string with the
     * corresponding field values from the wired record.
     * Falls back gracefully when the record has not yet loaded.
     */
    _resolveText(template) {
        if (!template) return template;

        // No tokens – return the static string unchanged
        if (!template.includes('{{')) return template;

        // Record not yet available – strip tokens so they don't show as raw text
        if (!this._record || !this._objectApiName) {
            return template.replace(new RegExp(MERGE_FIELD_PATTERN.source, 'g'), '');
        }

        return template.replace(new RegExp(MERGE_FIELD_PATTERN.source, 'g'), (match, fieldName) => {
            try {
                const value = getFieldValue(this._record, `${this._objectApiName}.${fieldName}`);
                return value !== null && value !== undefined ? String(value) : '';
            } catch {
                // Field not found or not fetched – return empty rather than raw token
                return '';
            }
        });
    }

    async _runFlow(flowApiName) {
        if (!flowApiName?.trim()) return;

        this.isLoading = true;
        try {
            await invokeFlow({
                flowApiName: flowApiName.trim(),
                recordId: this.recordId || null
            });
            if (this.recordId) {
                getRecordNotifyChange([{ recordId: this.recordId }]);
            }
            this._showToast('Success', 'Action completed successfully.', 'success');
        } catch (error) {
            const message =
                error?.body?.message ||
                error?.message ||
                'An unexpected error occurred.';
            this._showToast('Error', message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    _showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
