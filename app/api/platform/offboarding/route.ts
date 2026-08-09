import {
  initiateOffboarding,
  exportOrganizationData,
  settleFinancials,
  retainData,
  deleteOrganizationData,
} from "@nexora/billing";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// OFFBOARDING API
// ============================================================================
// Handles tenant offboarding: data export, settlement, retention, deletion
// ============================================================================

interface OffboardingPayload {
  organizationId: string;
  action: string;
  retentionDays?: number;
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const payload = await readJson<OffboardingPayload>(request);

    if (!payload.organizationId) {
      throw new ApiError(400, "organizationId is required");
    }

    if (!payload.action) {
      throw new ApiError(400, "action is required");
    }

    switch (payload.action) {
      case "initiate": {
        const progress = await initiateOffboarding(payload.organizationId);
        return apiJson(progress, 200, requestId);
      }

      case "export": {
        const exportResult = await exportOrganizationData(
          payload.organizationId
        );
        return apiJson(exportResult, 200, requestId);
      }

      case "settle": {
        const settlement = await settleFinancials(payload.organizationId);
        return apiJson(settlement, 200, requestId);
      }

      case "retain": {
        await retainData(
          payload.organizationId,
          payload.retentionDays || 90
        );
        return apiJson({ success: true }, 200, requestId);
      }

      case "delete": {
        await deleteOrganizationData(payload.organizationId);
        return apiJson({ success: true }, 200, requestId);
      }

      default:
        throw new ApiError(
          400,
          "Invalid action. Must be: initiate, export, settle, retain, or delete"
        );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Offboarding failed:", message);
    return apiJson({ error: "Offboarding request failed" }, 500, requestId);
  }
}
