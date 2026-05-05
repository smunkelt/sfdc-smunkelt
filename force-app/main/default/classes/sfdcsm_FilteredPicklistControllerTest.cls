/**
 * Test class for sfdcsm_FilteredPicklistController.
 *
 * Coverage strategy
 * -----------------
 * resolveRecordTypeId() has two code paths:
 *   1. Guard clause  - returns null when sObjectType or developerName is blank/null
 *   2. SOQL branch   - queries RecordType and returns the Id or null
 *
 * The positive SOQL test queries an active RecordType that already exists in
 * the org instead of inserting test data, because RecordType records cannot
 * be created via DML in Apex tests.
 */
@IsTest
private class sfdcsm_FilteredPicklistController_Test {

    // Guard clause: blank / null inputs

    @IsTest
    static void resolveRecordTypeId_blankSObjectType_returnsNull() {
        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId('', 'SDO_Service_Case');
        Test.stopTest();
        Assert.isNull(result, 'Expected null for blank sObjectType');
    }

    @IsTest
    static void resolveRecordTypeId_nullSObjectType_returnsNull() {
        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId(null, 'SDO_Service_Case');
        Test.stopTest();
        Assert.isNull(result, 'Expected null for null sObjectType');
    }

    @IsTest
    static void resolveRecordTypeId_blankDeveloperName_returnsNull() {
        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId('Case', '');
        Test.stopTest();
        Assert.isNull(result, 'Expected null for blank developerName');
    }

    @IsTest
    static void resolveRecordTypeId_nullDeveloperName_returnsNull() {
        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId('Case', null);
        Test.stopTest();
        Assert.isNull(result, 'Expected null for null developerName');
    }

    @IsTest
    static void resolveRecordTypeId_bothBlank_returnsNull() {
        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId('', '');
        Test.stopTest();
        Assert.isNull(result, 'Expected null when both parameters are blank');
    }

    // SOQL branch: developer name not found

    @IsTest
    static void resolveRecordTypeId_nonExistentDeveloperName_returnsNull() {
        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId(
            'Case',
            'THIS_RECORD_TYPE_DEFINITELY_DOES_NOT_EXIST_XYZ'
        );
        Test.stopTest();
        Assert.isNull(result, 'Expected null when no matching record type exists');
    }

    // SOQL branch: valid inputs return the correct ID

    @IsTest
    static void resolveRecordTypeId_validInputs_returnsRecordTypeId() {
        // RecordType records cannot be inserted via DML in Apex tests, so we
        // query an existing active record type from the org as test data.
        List<RecordType> existing = [
            SELECT Id, SObjectType, DeveloperName
            FROM   RecordType
            WHERE  IsActive = true
            LIMIT  1
        ];

        if (existing.isEmpty()) {
            Assert.isTrue(true, 'No active record types in org - positive test skipped');
            return;
        }

        RecordType rt = existing[0];

        Test.startTest();
        String result = sfdcsm_FilteredPicklistController.resolveRecordTypeId(
            rt.SObjectType,
            rt.DeveloperName
        );
        Test.stopTest();

        Assert.areEqual(rt.Id, result,
            'Expected the correct record type ID for '
            + rt.SObjectType + '.' + rt.DeveloperName
        );
    }
}
