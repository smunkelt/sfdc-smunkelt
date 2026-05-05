/**
 * Apex controller for the sfdcsm_actionBanner LWC.
 * Provides a method to invoke a named autolaunched flow, optionally passing a
 * record Id as input.
 */
public with sharing class sfdcsm_ActionBannerFlowController {

    /**
     * Invokes a named autolaunched flow.
     *
     * @param flowApiName  Developer name / API name of the autolaunched flow
     * @param recordId     Id of the record to pass as the flow input variable
     *                     "recordId". May be null if not on a record page.
     */
    @AuraEnabled
    public static void invokeFlow(String flowApiName, String recordId) {
        if (String.isBlank(flowApiName)) {
            throw new AuraHandledException('flowApiName must not be blank.');
        }

        Map<String, Object> inputs = new Map<String, Object>();
        if (String.isNotBlank(recordId)) {
            inputs.put('recordId', recordId);
        }

        try {
            Flow.Interview interview =
                Flow.Interview.createInterview(flowApiName.trim(), inputs);
            interview.start();
        } catch (Exception ex) {
            throw new AuraHandledException(
                'Failed to invoke flow "' + flowApiName + '": ' + ex.getMessage()
            );
        }
    }
}
