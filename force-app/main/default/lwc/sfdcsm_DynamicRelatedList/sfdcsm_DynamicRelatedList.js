import { LightningElement, api } from 'lwc';
import getRelatedRecords from '@salesforce/apex/sfdcsm_DBDynamicRelatedListController.getRelatedRecords';
import LOCALE from '@salesforce/i18n/locale';
import TIME_ZONE from '@salesforce/i18n/timeZone';

export default class SfdcsmDynamicRelatedList extends LightningElement {
    @api recordId;
    @api relatedEntityDefinition;
    @api sourceLinkFieldPath;
    @api relatedListTitle;
    @api columnsToDisplay;
    @api columnLabels;
    @api columnAlignments;
    @api titleSize = 'standard';
    @api showWhenEmpty = false;
    @api sortField;
    @api sortOrder;
    @api filterCriteria;

    rows = [];
    columns = [];
    hasData = false;
    isLoading = true;
    error;

    connectedCallback() {
        this.initialize();
    }

    async initialize() {
        this.columns = this.buildColumns();
        if (!this.recordId || !this.relatedEntityDefinition) {
            this.rows = [];
            this.hasData = false;
            this.isLoading = false;
            return;
        }
        await this.loadData();
    }

    async loadData() {
        this.isLoading = true;
        this.error = undefined;
        try {
            const result = await getRelatedRecords({
                recordId: this.recordId,
                relatedEntityDefinition: this.relatedEntityDefinition,
                sourceLinkFieldPath: this.sourceLinkFieldPath,
                columnFieldPaths: this.columnsToDisplay,
                sortField: this.sortField,
                sortOrder: this.sortOrder,
                filterCriteria: this.filterCriteria
            });
            const rows = Array.isArray(result) ? result : [];
            this.rows = rows.map((row) => this.formatRowValues(row));
            this.hasData = this.rows.length > 0;
        } catch (e) {
            this.rows = [];
            this.hasData = false;
            this.error = e;
        } finally {
            this.isLoading = false;
        }
    }

    buildColumns() {
        const fields = this.parseCsv(this.columnsToDisplay);
        const labels = this.parseCsv(this.columnLabels);
        const alignments = this.parseCsv(this.columnAlignments);
        const columns = [];

        fields.forEach((fieldPath, index) => {
            const alignment = this.normalizeAlignment(alignments[index]);
            columns.push({
                label: labels[index] || this.defaultLabel(fieldPath),
                fieldName: `col_${index}`,
                wrapText: true,
                hideDefaultActions: true,
                cellAttributes: alignment ? { alignment } : undefined
            });
        });

        if (!columns.length) {
            columns.push({
                label: 'Id',
                fieldName: 'col_0',
                wrapText: true,
                hideDefaultActions: true
            });
        }
        return columns;
    }

    parseCsv(value) {
        if (!value) {
            return [];
        }
        return value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item);
    }

    normalizeAlignment(value) {
        if (!value) {
            return null;
        }
        const normalized = value.toLowerCase();
        if (['left', 'center', 'right'].includes(normalized)) {
            return normalized;
        }
        return null;
    }

    defaultLabel(fieldPath) {
        const lastSegment = fieldPath.split('.').pop() || fieldPath;
        return lastSegment.replace(/_/g, ' ');
    }

    get title() {
        return this.relatedListTitle || 'Related Records';
    }

    get errorMessage() {
        return this.error?.body?.message || 'Unable to load related records.';
    }

    get shouldRenderComponent() {
        return this.isLoading || this.error || this.hasData || this.showWhenEmpty;
    }

    get titleClass() {
        const sizeClassMap = {
            standard: 'slds-text-title_bold',
            small: 'slds-text-body_regular',
            medium: 'slds-text-heading_small',
            large: 'slds-text-heading_medium'
        };
        const sizeKey = (this.titleSize || 'standard').toLowerCase();
        const sizeClass = sizeClassMap[sizeKey] || sizeClassMap.standard;
        return `slds-m-left_small slds-m-bottom_x-small ${sizeClass}`;
    }

    formatRowValues(row) {
        const formattedRow = { ...row };
        const fields = this.parseCsv(this.columnsToDisplay);
        Object.keys(formattedRow).forEach((key) => {
            if (!key.startsWith('col_')) {
                return;
            }
            const index = Number(key.replace('col_', ''));
            const fieldPath = Number.isNaN(index) ? null : fields[index];
            formattedRow[key] = this.formatValue(formattedRow[key], fieldPath);
        });
        return formattedRow;
    }

    formatValue(value, fieldPath) {
        if (typeof value === 'number' && this.isLikelyTimeField(fieldPath) && this.isMillisecondsSinceMidnight(value)) {
            return this.formatMillisecondsAsTime(value);
        }

        if (typeof value !== 'string') {
            return value;
        }

        if (this.isLikelyTimeField(fieldPath) && /^\d+$/.test(value) && this.isMillisecondsSinceMidnight(Number(value))) {
            return this.formatMillisecondsAsTime(Number(value));
        }

        if (this.isIsoDateTime(value)) {
            const dateTimeValue = new Date(value);
            if (Number.isNaN(dateTimeValue.getTime())) {
                return value;
            }
            return new Intl.DateTimeFormat(LOCALE, {
                dateStyle: 'short',
                timeStyle: 'medium',
                timeZone: TIME_ZONE
            }).format(dateTimeValue);
        }

        if (this.isIsoDate(value)) {
            const [year, month, day] = value.split('-').map((part) => Number(part));
            const dateValue = new Date(Date.UTC(year, month - 1, day));
            return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC' }).format(dateValue);
        }

        if (this.isIsoTime(value)) {
            const timeMatch = value.match(/^(\d{2}):(\d{2}):(\d{2})/);
            if (!timeMatch) {
                return value;
            }
            const hour = Number(timeMatch[1]);
            const minute = Number(timeMatch[2]);
            const second = Number(timeMatch[3]);
            const timeValue = new Date(Date.UTC(1970, 0, 1, hour, minute, second));
            return new Intl.DateTimeFormat(LOCALE, {
                hour: 'numeric',
                minute: '2-digit',
                second: second ? '2-digit' : undefined,
                timeZone: 'UTC'
            }).format(timeValue);
        }

        return value;
    }

    isIsoDate(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    isIsoDateTime(value) {
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value);
    }

    isIsoTime(value) {
        return /^\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(value);
    }

    isLikelyTimeField(fieldPath) {
        if (!fieldPath) {
            return false;
        }
        const lastSegment = fieldPath.split('.').pop() || '';
        return /time$/i.test(lastSegment);
    }

    isMillisecondsSinceMidnight(value) {
        return Number.isInteger(value) && value >= 0 && value < 24 * 60 * 60 * 1000;
    }

    formatMillisecondsAsTime(milliseconds) {
        const hours = Math.floor(milliseconds / (60 * 60 * 1000));
        const remainingAfterHours = milliseconds % (60 * 60 * 1000);
        const minutes = Math.floor(remainingAfterHours / (60 * 1000));
        const seconds = Math.floor((remainingAfterHours % (60 * 1000)) / 1000);
        const timeValue = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
        return new Intl.DateTimeFormat(LOCALE, {
            hour: 'numeric',
            minute: '2-digit',
            second: seconds ? '2-digit' : undefined,
            timeZone: 'UTC'
        }).format(timeValue);
    }
}
