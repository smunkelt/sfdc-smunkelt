@IsTest
private class sfdcsm_DBDynamicRelatedListControllerTest {

    @IsTest
    static void getRelatedRecords_returnsConfiguredColumnsAndSortingAndFilter() {
        Account parentAccount = new Account(Name = 'DocBuilder Parent Account');
        insert parentAccount;

        Account includedChild = new Account(Name = 'Alpha Child', ParentId = parentAccount.Id);
        Account excludedChild = new Account(Name = 'Zulu Child', ParentId = parentAccount.Id);
        insert new List<Account>{ includedChild, excludedChild };

        Test.startTest();
        List<Map<String, Object>> results = sfdcsm_DBDynamicRelatedListController.getRelatedRecords(
            parentAccount.Id,
            'Account:ParentId',
            null,
            'Name,Parent.Name',
            'Name',
            'ASC',
            'Name = \'Alpha Child\''
        );
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Only one child account should match the filter criteria.');
        System.assertEquals('Alpha Child', (String)results[0].get('col_0'), 'First configured column should map by index.');
        System.assertEquals('DocBuilder Parent Account', (String)results[0].get('col_1'), 'Relationship field should be supported.');
    }

    @IsTest
    static void getRelatedRecords_returnsEmptyOnMissingConfig() {
        List<Map<String, Object>> noRecordResults = sfdcsm_DBDynamicRelatedListController.getRelatedRecords(
            null,
            'Account:ParentId',
            null,
            'Name',
            null,
            null,
            null
        );
        System.assertEquals(0, noRecordResults.size(), 'Null record Id should return an empty list.');

        Account accountRecord = new Account(Name = 'No Config Account');
        insert accountRecord;

        List<Map<String, Object>> noDefinitionResults = sfdcsm_DBDynamicRelatedListController.getRelatedRecords(
            accountRecord.Id,
            null,
            null,
            'Name',
            null,
            null,
            null
        );
        System.assertEquals(0, noDefinitionResults.size(), 'Blank related entity definition should return an empty list.');
    }

    @IsTest
    static void getRelatedRecords_throwsOnInvalidDefinition() {
        Account accountRecord = new Account(Name = 'Bad Definition Account');
        insert accountRecord;

        try {
            sfdcsm_DBDynamicRelatedListController.getRelatedRecords(
                accountRecord.Id,
                'Account',
                null,
                'Name',
                null,
                null,
                null
            );
            System.assert(false, 'Expected an AuraHandledException for invalid definition format.');
        } catch (AuraHandledException e) {
            String message = e.getMessage();
            System.assert(
                message != null && (
                    message.contains('Invalid related entity definition') ||
                    message.contains('Script-thrown exception')
                ),
                'Exception message should indicate invalid definition failure.'
            );
        }
    }

    @IsTest
    static void getRelatedRecords_supportsSourceLinkFieldPath() {
        Account parentAccount = new Account(Name = 'Link Source Parent');
        insert parentAccount;

        Account sourceChild = new Account(Name = 'Source', ParentId = parentAccount.Id);
        Account siblingChild = new Account(Name = 'Sibling', ParentId = parentAccount.Id);
        insert new List<Account>{ sourceChild, siblingChild };

        Test.startTest();
        List<Map<String, Object>> results = sfdcsm_DBDynamicRelatedListController.getRelatedRecords(
            sourceChild.Id,
            'Account:ParentId',
            'ParentId',
            'Name',
            'Name',
            'ASC',
            null
        );
        Test.stopTest();

        System.assertEquals(2, results.size(), 'Source linkage field should allow fetching records via parent Id.');
        System.assertEquals('Sibling', (String)results[0].get('col_0'), 'Sorted first record should be Sibling.');
        System.assertEquals('Source', (String)results[1].get('col_0'), 'Sorted second record should be Source.');
    }

    @IsTest
    static void getRelatedRecords_supportsNestedSourceLinkFieldPath() {
        Account grandParent = new Account(Name = 'Grand Parent');
        insert grandParent;

        Account parentA = new Account(Name = 'Parent A', ParentId = grandParent.Id);
        Account parentB = new Account(Name = 'Parent B', ParentId = grandParent.Id);
        insert new List<Account>{ parentA, parentB };

        Account sourceChild = new Account(Name = 'Source Child', ParentId = parentA.Id);
        insert sourceChild;

        Test.startTest();
        List<Map<String, Object>> results = sfdcsm_DBDynamicRelatedListController.getRelatedRecords(
            sourceChild.Id,
            'Account:ParentId',
            'Parent.ParentId',
            'Name',
            'Name',
            'ASC',
            null
        );
        Test.stopTest();

        System.assertEquals(2, results.size(), 'Nested source linkage should resolve to grandparent and return its direct children.');
        System.assertEquals('Parent A', (String)results[0].get('col_0'), 'First sorted record should be Parent A.');
        System.assertEquals('Parent B', (String)results[1].get('col_0'), 'Second sorted record should be Parent B.');
    }
}
