import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import resolveRecordTypeId from '@salesforce/apex/sfdcsm_FilteredPicklistController.resolveRecordTypeId';

const NONE_OPTION = { label: '--None--', value: '' };

/**
 * Returns true when the string looks like a Salesforce record type ID
 * (key prefix 012, 15 or 18 characters).
 */
const isRecordTypeId = value =>
    typeof value === 'string' &&
    /^012[a-zA-Z0-9]{12}([a-zA-Z0-9]{3})?$/.test(value);

export default class Sfdcsm_filteredPicklist extends LightningElement {

    // ── Public API ────────────────────────────────────────────────────────────

    /** API name of the SObject, e.g. "Case" or "WorkOrder" */
    @api objectApiName;

    /**
     * Identifies the record type whose picklist values should be shown.
     * Accepts either:
     *   • Developer name  e.g. "SDO_Service_Case"   → resolved via Apex SOQL
     *   • Record type ID  e.g. "012xx…"              → used directly
     * Leave blank to show all values (master record type).
     */
    @api
    get recordTypeName() { return this._recordTypeName; }
    set recordTypeName(value) {
        this._recordTypeName = value;
        if (isRecordTypeId(value)) {
            // ID supplied — use immediately; Apex wire must not fire
            this._recordTypeId = value;
            this._apexDevName  = undefined;
        } else if (value) {
            // Developer name — feed to Apex wire; clear any previous direct ID
            this._apexDevName  = value;
        } else {
            // Blank — master RT will be resolved from getObjectInfo
            this._apexDevName  = undefined;
        }
    }

    /** API name of the picklist field, e.g. "Status" or "Priority__c" */
    @api fieldApiName;

    /** When true, prepends a "--None--" entry to the option list */
    @api includeNone = false;

    /** Label rendered above the combobox */
    @api label = 'Select';

    /** Placeholder text shown when no value has been chosen */
    @api placeholder = '-- Select --';

    /** Marks the field as required (shows red asterisk) */
    @api required = false;

    /**
     * Currently selected value.
     * Bidirectional: the flow sets this from its stored auto-variable on every
     * component (re)creation, which restores the selection after a failed
     * validation on a sibling component causes the screen to re-render.
     */
    @api
    get value() { return this._value; }
    set value(v) { this._value = v ?? ''; }

    // ── Private state ─────────────────────────────────────────────────────────

    _recordTypeName;

    @track _value = '';

    /**
     * Developer name forwarded to the Apex wire.
     * Undefined when recordTypeName is blank or already an ID, which prevents
     * the Apex wire from firing unnecessarily.
     */
    @track _apexDevName;

    /**
     * Resolved record type ID that drives getPicklistValues.
     * Set from (in priority order):
     *   1. Direct ID assignment via the recordTypeName setter
     *   2. Apex resolveRecordTypeId wire result
     *   3. Master record type ID from getObjectInfo (blank recordTypeName)
     */
    @track _recordTypeId;

    /**
     * Fully-qualified field token, e.g. "Case.Status".
     * Set once getObjectInfo confirms the object is valid.
     */
    @track _qualifiedField;

    /** Master record type ID stored so the Apex fallback can use it */
    _masterRecordTypeId;

    /** Holds error messages from any wire adapter */
    @track _error;

    // ── Wire 1: getObjectInfo ─────────────────────────────────────────────────
    // Purpose: (a) validate the object and build the qualified field token;
    //          (b) supply the master record type ID when no recordTypeName is given.

    @wire(getObjectInfo, { objectApiName: '$objectApiName' })
    _handleObjectInfo({ data, error }) {
        if (data) {
            this._error = null;

            // Build the qualified field token now that the object is known valid
            this._qualifiedField =
                this.objectApiName && this.fieldApiName
                    ? `${this.objectApiName}.${this.fieldApiName}`
                    : undefined;

            // Cache the master RT ID for fallback use
            const master = Object.values(data.recordTypeInfos)
                .find(rt => rt.master === true);
            this._masterRecordTypeId = master?.recordTypeId;

            // Use master when no recordTypeName specified
            if (!this._recordTypeName) {
                this._recordTypeId = this._masterRecordTypeId;
            }
        }
        if (error) {
            this._error = error?.body?.message ?? 'Could not load object info.';
        }
    }

    // ── Wire 2: resolveRecordTypeId (Apex, cacheable) ─────────────────────────
    // Purpose: convert a developer name → record type ID via SOQL.
    // Only fires when _apexDevName is a non-empty string.

    @wire(resolveRecordTypeId, {
        sObjectType:   '$objectApiName',
        developerName: '$_apexDevName'
    })
    _handleResolvedRtId({ data, error }) {
        if (data) {
            this._recordTypeId = data;
        } else if (data === null) {
            // Developer name exists but no active record type found — fall back to master
            this._recordTypeId = this._masterRecordTypeId;
        }
        if (error) {
            this._error = error?.body?.message ?? 'Record type not found.';
        }
    }

    // ── Wire 3: getPicklistValues ─────────────────────────────────────────────
    // Fires only when both _recordTypeId and _qualifiedField are set.

    @wire(getPicklistValues, {
        recordTypeId: '$_recordTypeId',
        fieldApiName: '$_qualifiedField'
    })
    _picklistData;

    // ── Computed properties ───────────────────────────────────────────────────

    /** True while any required data is still in flight */
    get isLoading() {
        if (!this.objectApiName || !this.fieldApiName) return false;
        if (this._error) return false;
        if (!this._recordTypeId || !this._qualifiedField) return true;
        return !this._picklistData?.data && !this._picklistData?.error;
    }

    get hasError() {
        return !!(this._error || this._picklistData?.error);
    }

    get errorMessage() {
        return (
            this._error ??
            this._picklistData?.error?.body?.message ??
            'Failed to load picklist values.'
        );
    }

    get options() {
        const vals = this._picklistData?.data?.values ?? [];
        const opts = vals.map(({ label, value }) => ({ label, value }));
        return this.includeNone ? [NONE_OPTION, ...opts] : opts;
    }

    // ── Flow validation ──────────────────────────────────────────────────────

    /**
     * Called by the Flow runtime before navigating to the next screen.
     * Must return { isValid: true } or { isValid: false, errorMessage: '...' }.
     * Without this method the flow never blocks navigation, even when required=true.
     */
    @api
    validate() {
        if (this.required && !this._value) {
            // Trigger the combobox's native SLDS validation UI (red border + message)
            const combobox = this.template.querySelector('lightning-combobox');
            if (combobox) {
                combobox.reportValidity();
            }
            return {
                isValid: false,
                errorMessage: 'Please select a value.'
            };
        }
        return { isValid: true };
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    handleChange(event) {
        const newValue = event.detail.value;
        this._value = newValue;
        this.dispatchEvent(new FlowAttributeChangeEvent('value', newValue));
        this.dispatchEvent(new CustomEvent('change', { detail: { value: newValue } }));
    }
}
