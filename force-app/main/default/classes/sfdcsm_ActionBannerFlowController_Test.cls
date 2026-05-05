/**
 * Test class for sfdcsm_ActionBannerFlowController.
 *
 * Coverage strategy
 * ─────────────────
 * Flow.Interview cannot be mocked in Apex unit tests, so the success path
 * (a real, active flow executing) is not exercised here. Instead the tests
 * verify every guard and exception-wrapping branch of invokeFlow():
 *
 *  1. Blank, null, and whitespace flowApiName  → AuraHandledException (guard)
 *  2. Non-existent flow name                  → AuraHandledException (catch wrap)
 *  3. Non-existent flow + valid recordId      → inputs map branch + catch wrap
 *  4. Non-existent flow + empty recordId      → empty-recordId branch + catch wrap
 */
@IsTest
private class sfdcsm_ActionBannerFlowController_Test {

    // ── Guard: blank / null / whitespace flowApiName ──────────────────────────

    @IsTest
    static void invokeFlow_blankApiName_throwsAuraHandledException() {
        Boolean thrown = false;
        try {
            sfdcsm_ActionBannerFlowController.invokeFlow('', null);
        } catch (AuraHandledException ex) {
            thrown = true;
        }
        Assert.isTrue(thrown, 'Expected AuraHandledException for a blank flowApiName.');
    }

    @IsTest
    static void invokeFlow_nullApiName_throwsAuraHandledException() {
        Boolean thrown = false;
        try {
            sfdcsm_ActionBannerFlowController.invokeFlow(null, null);
        } catch (AuraHandledException ex) {
            thrown = true;
        }
        Assert.isTrue(thrown, 'Expected AuraHandledException for a null flowApiName.');
    }

    @IsTest
    static void invokeFlow_whitespaceApiName_throwsAuraHandledException() {
        Boolean thrown = false;
        try {
            sfdcsm_ActionBannerFlowController.invokeFlow('   ', null);
        } catch (AuraHandledException ex) {
            thrown = true;
        }
        Assert.isTrue(thrown, 'Expected AuraHandledException for a whitespace-only flowApiName.');
    }

    // ── Exception wrapping: non-existent flow, no recordId ───────────────────

    @IsTest
    static void invokeFlow_nonExistentFlow_nullRecordId_throwsAuraHandledException() {
        Boolean thrown = false;
        try {
            sfdcsm_ActionBannerFlowController.invokeFlow('sfdcsm_NonExistentFlow_Test', null);
        } catch (AuraHandledException ex) {
            thrown = true;
        }
        Assert.isTrue(thrown,
            'Expected AuraHandledException when the flow does not exist and recordId is null.');
    }

    // ── Exception wrapping: non-existent flow, empty recordId ────────────────

    @IsTest
    static void invokeFlow_nonExistentFlow_emptyRecordId_throwsAuraHandledException() {
        Boolean thrown = false;
        try {
            sfdcsm_ActionBannerFlowController.invokeFlow('sfdcsm_NonExistentFlow_Test', '');
        } catch (AuraHandledException ex) {
            thrown = true;
        }
        Assert.isTrue(thrown,
            'Expected AuraHandledException when the flow does not exist and recordId is empty.');
    }

    // ── Exception wrapping: non-existent flow, valid recordId ────────────────
    // Exercises the String.isNotBlank(recordId) branch that puts recordId into
    // the inputs map before handing it to Flow.Interview.

    @IsTest
    static void invokeFlow_nonExistentFlow_withRecordId_throwsAuraHandledException() {
        Boolean thrown = false;
        // Syntactically valid 18-char fake Account Id; no DML needed.
        String fakeId = '001000000000001AAA';
        try {
            sfdcsm_ActionBannerFlowController.invokeFlow('sfdcsm_NonExistentFlow_Test', fakeId);
        } catch (AuraHandledException ex) {
            thrown = true;
        }
        Assert.isTrue(thrown,
            'Expected AuraHandledException when the flow does not exist and a recordId is supplied.');
    }
}
