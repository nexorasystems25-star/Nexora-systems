import {
  runFullReview,
  checkDependencyDrift,
  runSecurityScan,
  runPerformanceCheck,
  getReviewsForProduct,
  getPendingReviews,
} from "@nexora/aicos";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// ARCHITECTURE REVIEW API
// ============================================================================
// Handles automated architecture reviews, dependency audits, security scans
// ============================================================================

interface ArchitecturePayload {
  action: string;
  productId?: string;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (productId) {
      const reviews = getReviewsForProduct(productId);
      return apiJson(reviews, 200, requestId);
    }

    const pending = getPendingReviews();
    return apiJson({ pending, count: pending.length }, 200, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch reviews:", message);
    return apiJson({ error: "Failed to fetch reviews" }, 500, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const payload = await readJson<ArchitecturePayload>(request);

    if (!payload.action) {
      throw new ApiError(400, "action is required");
    }

    switch (payload.action) {
      case "full-review": {
        if (!payload.productId) {
          throw new ApiError(400, "productId is required for full review");
        }
        const review = runFullReview(payload.productId);
        return apiJson(review, 200, requestId);
      }

      case "dependency-check": {
        if (!payload.productId) {
          throw new ApiError(400, "productId is required for dependency check");
        }
        const findings = checkDependencyDrift(payload.productId);
        return apiJson({ findings, count: findings.length }, 200, requestId);
      }

      case "security-scan": {
        if (!payload.productId) {
          throw new ApiError(400, "productId is required for security scan");
        }
        const findings = runSecurityScan(payload.productId);
        return apiJson({ findings, count: findings.length }, 200, requestId);
      }

      case "performance-check": {
        if (!payload.productId) {
          throw new ApiError(400, "productId is required for performance check");
        }
        const findings = runPerformanceCheck(payload.productId);
        return apiJson({ findings, count: findings.length }, 200, requestId);
      }

      default:
        throw new ApiError(
          400,
          "Invalid action. Must be: full-review, dependency-check, security-scan, or performance-check"
        );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Architecture review failed:", message);
    return apiJson({ error: "Architecture review failed" }, 500, requestId);
  }
}
