/**
 * Server-side support for sfdcsm_filteredPicklist LWC.
 *
 * Resolves a record type developer name to its Salesforce ID via SOQL so
 * that the LWC does not have to depend on undocumented wire-response
 * properties (e.g. RecordTypeInfo.developerName) whose availability varies
 * across API versions.
 */
public with sharing class sfdcsm_FilteredPicklistController {

    /**
     * Returns the record type ID for the given sObject type and developer name.
     *
     * @param  sObjectType   API name of the sObject, e.g. "Case"
     * @param  developerName Developer name of the record type, e.g. "SDO_Service_Case"
     * @return               The record type ID, or null if not found / inactive
     * @throws AuraHandledException on unexpected query errors
     */
    @AuraEnabled(cacheable=true)
    public static String resolveRecordTypeId(String sObjectType, String developerName) {
        if (String.isBlank(sObjectType) || String.isBlank(developerName)) {
            return null;
        }
        try {
            List<RecordType> rts = [
                SELECT Id
                FROM   RecordType
                WHERE  SObjectType   = :sObjectType
                AND    DeveloperName = :developerName
                AND    IsActive      = true
                LIMIT  1
            ];
            return rts.isEmpty() ? null : rts[0].Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
