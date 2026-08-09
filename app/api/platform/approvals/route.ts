import {
  requestApproval,
  approveRequest,
  rejectRequest,
  getPendingApprovals,
} from "@nexora/billing";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// APPROVALS API
// ============================================================================
// Handles human approval gates for sensitive operations
// ============================================================================

interface ApprovalsPayload {
  action: string;
  requestId?: string;
  type?: string;
  requestedBy?: string;
  organizationId?: string;
  notes?: string;
  reason?: string;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const approvals = await getPendingApprovals();
    return apiJson(approvals, 200, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch approvals:", message);
    return apiJson({ error: "Failed to fetch approvals" }, 500, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const payload = await readJson<ApprovalsPayload>(request);

    if (!payload.action) {
      throw new ApiError(400, "action is required");
    }

    switch (payload.action) {
      case "request": {
        if (!payload.type) {
          throw new ApiError(400, "type is required for request action");
        }
        if (!payload.requestedBy) {
          throw new ApiError(400, "requestedBy is required for request action");
        }
        if (!payload.organizationId) {
          throw new ApiError(
            400,
            "organizationId is required for request action"
          );
        }

        const approval = await requestApproval(
          payload.type as any,
          payload.requestedBy,
          payload.organizationId,
          payload.notes
        );
        return apiJson(approval, 201, requestId);
      }

      case "approve": {
        if (!payload.requestId) {
          throw new ApiError(400, "requestId is required for approve action");
        }
        if (!payload.requestedBy) {
          throw new ApiError(400, "requestedBy is required for approve action");
        }

        const approved = await approveRequest(
          payload.requestId,
          payload.requestedBy,
          payload.notes
        );
        return apiJson(approved, 200, requestId);
      }

      case "reject": {
        if (!payload.requestId) {
          throw new ApiError(400, "requestId is required for reject action");
        }
        if (!payload.requestedBy) {
          throw new ApiError(400, "requestedBy is required for reject action");
        }
        if (!payload.reason) {
          throw new ApiError(400, "reason is required for reject action");
        }

        const rejected = await rejectRequest(
          payload.requestId,
          payload.requestedBy,
          payload.reason
        );
        return apiJson(rejected, 200, requestId);
      }

      default:
        throw new ApiError(
          400,
          "Invalid action. Must be: request, approve, or reject"
        );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Approval request failed:", message);
    return apiJson({ error: "Approval request failed" }, 500, requestId);
  }
}
