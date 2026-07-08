public with sharing class sfdcsm_DBDynamicRelatedListController {

    private static final Integer MAX_ROW_LIMIT = 500;

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getRelatedRecords(
        Id recordId,
        String relatedEntityDefinition,
        String sourceLinkFieldPath,
        String columnFieldPaths,
        String sortField,
        String sortOrder,
        String filterCriteria
    ) {
        if (recordId == null || String.isBlank(relatedEntityDefinition)) {
            return new List<Map<String, Object>>();
        }

        RelatedEntityDefinition definition = parseDefinition(relatedEntityDefinition);
        List<String> columns = parseCsv(columnFieldPaths);
        if (columns.isEmpty()) {
            columns.add('Id');
        }

        validateFieldPaths(columns);
        if (!String.isBlank(sortField)) {
            validateFieldPath(sortField.trim());
        }
        validateFilterCriteria(filterCriteria);

        Object linkageValue = resolveLinkageValue(recordId, sourceLinkFieldPath);
        if (linkageValue == null) {
            return new List<Map<String, Object>>();
        }

        String query = buildQuery(linkageValue, definition, columns, sortField, sortOrder, filterCriteria);
        List<SObject> records = Database.query(query);

        List<Map<String, Object>> output = new List<Map<String, Object>>();
        for (SObject record : records) {
            Map<String, Object> row = new Map<String, Object>();
            row.put('id', record.get('Id'));
            for (Integer i = 0; i < columns.size(); i++) {
                row.put('col_' + i, getNestedFieldValue(record, columns[i]));
            }
            output.add(row);
        }
        return output;
    }

    private static String buildQuery(
        Object linkageValue,
        RelatedEntityDefinition definition,
        List<String> columns,
        String sortField,
        String sortOrder,
        String filterCriteria
    ) {
        String query = 'SELECT Id';
        for (String fieldPath : columns) {
            if (!'Id'.equalsIgnoreCase(fieldPath)) {
                query += ', ' + fieldPath;
            }
        }

        query += ' FROM ' + definition.childObjectApiName;
        query += ' WHERE ' + definition.parentLookupFieldApiName + ' = :linkageValue';

        if (!String.isBlank(filterCriteria)) {
            query += ' AND (' + filterCriteria.trim() + ')';
        }

        if (!String.isBlank(sortField)) {
            String normalizedSortOrder = 'ASC';
            if (!String.isBlank(sortOrder) && 'DESC'.equalsIgnoreCase(sortOrder.trim())) {
                normalizedSortOrder = 'DESC';
            }
            query += ' ORDER BY ' + sortField.trim() + ' ' + normalizedSortOrder;
        }

        query += ' LIMIT ' + MAX_ROW_LIMIT;
        return query;
    }

    private static Object resolveLinkageValue(Id recordId, String sourceLinkFieldPath) {
        if (String.isBlank(sourceLinkFieldPath)) {
            return recordId;
        }

        String cleanedPath = sourceLinkFieldPath.trim();
        validateFieldPath(cleanedPath);

        String sourceObjectApiName = recordId.getSObjectType().getDescribe().getName();
        String sourceQuery = 'SELECT ' + cleanedPath + ' FROM ' + sourceObjectApiName + ' WHERE Id = :recordId LIMIT 1';
        List<SObject> sourceRecords = Database.query(sourceQuery);
        if (sourceRecords.isEmpty()) {
            return null;
        }

        return getNestedFieldValue(sourceRecords[0], cleanedPath);
    }

    private static RelatedEntityDefinition parseDefinition(String relatedEntityDefinition) {
        List<String> parts = relatedEntityDefinition.split(':');
        if (parts.size() != 2 || String.isBlank(parts[0]) || String.isBlank(parts[1])) {
            throw new AuraHandledException(
                'Invalid related entity definition. Use format ChildObjectApiName:LookupFieldApiName.'
            );
        }

        String childObjectApiName = parts[0].trim();
        String parentLookupFieldApiName = parts[1].trim();

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        if (!globalDescribe.containsKey(childObjectApiName)) {
            throw new AuraHandledException('Unknown related object: ' + childObjectApiName);
        }

        Map<String, Schema.SObjectField> fields = globalDescribe
            .get(childObjectApiName)
            .getDescribe()
            .fields.getMap();
        if (!fields.containsKey(parentLookupFieldApiName)) {
            throw new AuraHandledException(
                'Lookup field ' + parentLookupFieldApiName + ' does not exist on ' + childObjectApiName + '.'
            );
        }

        return new RelatedEntityDefinition(childObjectApiName, parentLookupFieldApiName);
    }

    private static List<String> parseCsv(String input) {
        List<String> values = new List<String>();
        if (String.isBlank(input)) {
            return values;
        }

        for (String token : input.split(',')) {
            if (!String.isBlank(token)) {
                values.add(token.trim());
            }
        }
        return values;
    }

    private static void validateFieldPaths(List<String> fieldPaths) {
        for (String fieldPath : fieldPaths) {
            validateFieldPath(fieldPath);
        }
    }

    private static void validateFieldPath(String fieldPath) {
        if (String.isBlank(fieldPath)) {
            throw new AuraHandledException('Field path cannot be blank.');
        }

        String cleaned = fieldPath.trim();
        if (!Pattern.matches('^[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*$', cleaned)) {
            throw new AuraHandledException('Invalid field path: ' + fieldPath);
        }
    }

    private static void validateFilterCriteria(String filterCriteria) {
        if (String.isBlank(filterCriteria)) {
            return;
        }

        String value = filterCriteria.trim();
        if (value.contains(';') || value.contains('--')) {
            throw new AuraHandledException('Invalid filter criteria.');
        }

        if (!Pattern.matches('^[A-Za-z0-9_\\.\\(\\)\\,\\s\\=\\<\\>\\!\\%\\\'\\\"\\:\\-\\+]+$', value)) {
            throw new AuraHandledException('Filter criteria contains unsupported characters.');
        }

        String lowerValue = value.toLowerCase();
        if (
            lowerValue.contains(' select ') ||
            lowerValue.contains(' from ') ||
            lowerValue.contains(' order by ') ||
            lowerValue.contains(' limit ') ||
            lowerValue.contains(' offset ')
        ) {
            throw new AuraHandledException('Filter criteria contains unsupported keywords.');
        }
    }

    private static Object getNestedFieldValue(SObject record, String fieldPath) {
        List<String> pathParts = fieldPath.split('\\.');
        SObject current = record;

        for (Integer i = 0; i < pathParts.size(); i++) {
            String part = pathParts[i];
            Boolean isLast = (i == pathParts.size() - 1);
            if (current == null) {
                return null;
            }

            if (isLast) {
                Object rawValue = current.get(part);
                if (rawValue instanceof Time) {
                    // Serialize Time as a string so LWC can apply locale-specific formatting reliably.
                    return String.valueOf(rawValue);
                }
                return rawValue;
            }
            current = current.getSObject(part);
        }

        return null;
    }

    private class RelatedEntityDefinition {
        public String childObjectApiName { get; private set; }
        public String parentLookupFieldApiName { get; private set; }

        public RelatedEntityDefinition(String childObjectApiName, String parentLookupFieldApiName) {
            this.childObjectApiName = childObjectApiName;
            this.parentLookupFieldApiName = parentLookupFieldApiName;
        }
    }
}
