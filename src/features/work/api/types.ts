import type { components, operations } from '@/lib/api/schema';

/** Type module Công việc — alias của schema sinh từ OpenAPI (luật 2, không khai báo lại shape). */
type S = components['schemas'];

export type WorkItemSummary = S['WorkItemSummaryDto'];
export type WorkItemDetail = S['WorkItemDetailDto'];
export type WorkItemList = S['WorkItemListDto'];
export type WorkCounts = S['WorkCountsDto'];
export type WorkDeadline = S['WorkDeadlineDto'];
export type WorkPerson = S['WorkPersonDto'];
export type WorkEvent = S['WorkEventDto'];
export type WorkChecklistItem = S['WorkChecklistItemDto'];
export type WorkActions = S['WorkActionsDto'];
export type WorkAssigneeOption = S['WorkAssigneeOptionDto'];
export type WorkWorkload = S['WorkWorkloadDto'];
export type WorkWorkloadRow = S['WorkWorkloadRowDto'];
export type WorkNotification = S['WorkNotificationDto'];
export type WorkBulkResult = S['WorkBulkResultDto'];
export type CreateWorkItemBody = S['CreateWorkItemDto'];
export type UpdateWorkItemBody = S['UpdateWorkItemDto'];
export type WorkChecklistInput = S['WorkChecklistInputDto'];

export type WorkConfig = S['WorkConfigDto'];
export type WorkCategory = S['WorkCategoryDto'];
export type WorkCalendar = S['WorkCalendarDto'];
export type WorkHoliday = S['WorkHolidayDto'];
export type WorkDepartmentOption = S['WorkDepartmentOptionDto'];
export type CreateWorkCategoryBody = S['CreateWorkCategoryDto'];
export type UpdateWorkCategoryBody = S['UpdateWorkCategoryDto'];
export type UpdateWorkSlaBody = S['UpdateWorkSlaDto'];
export type WorkSlaRow = S['WorkSlaRowDto'];
export type UpdateWorkCalendarBody = S['UpdateWorkCalendarDto'];

export type WorkRequestReport = S['WorkRequestReportDto'];
export type WorkTaskReport = S['WorkTaskReportDto'];

export type WorkKind = WorkItemSummary['kind'];
export type WorkStatus = WorkItemSummary['status'];
export type WorkPriority = WorkItemSummary['priority'];
export type WorkChannel = NonNullable<WorkItemSummary['channel']>;
export type WorkEventType = WorkEvent['type'];

export type WorkListQuery = NonNullable<operations['WorkController_list']['parameters']['query']>;
export type WorkView = NonNullable<WorkListQuery['view']>;
