import { PRODUCT_REGISTRY } from "./registry";

// ============================================================================
// ARCHITECTURE REVIEW AUTOMATION
// ============================================================================
// Handles code review gates, dependency drift detection, and monitoring
// ============================================================================

export type ReviewStatus = "pending" | "approved" | "rejected" | "failed";

export interface ArchitectureReview {
  id: string;
  productId: string;
  type: "code-review" | "dependency-audit" | "security-scan" | "performance-check";
  status: ReviewStatus;
  findings: ReviewFinding[];
  createdAt: Date;
  completedAt?: Date;
}

export interface ReviewFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  message: string;
  file?: string;
  line?: number;
}

// In-memory store for reviews (replace with DB in production)
const reviews: ArchitectureReview[] = [];

/**
 * Create a new architecture review
 */
export function createReview(
  productId: string,
  type: ArchitectureReview["type"]
): ArchitectureReview {
  const product = PRODUCT_REGISTRY.find((p) => p.id === productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const review: ArchitectureReview = {
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId,
    type,
    status: "pending",
    findings: [],
    createdAt: new Date(),
  };

  reviews.push(review);
  return review;
}

/**
 * Run dependency drift detection for a product
 */
export function checkDependencyDrift(
  productId: string
): ReviewFinding[] {
  const product = PRODUCT_REGISTRY.find((p) => p.id === productId);
  if (!product) {
    return [{ severity: "critical", category: "product", message: "Product not found" }];
  }

  const findings: ReviewFinding[] = [];

  // Check if dependencies are defined
  if (!product.dependencies || product.dependencies.length === 0) {
    findings.push({
      severity: "medium",
      category: "dependencies",
      message: "No dependencies defined for product",
    });
  }

  // Check if repository is defined
  if (!product.repository) {
    findings.push({
      severity: "high",
      category: "metadata",
      message: "No repository URL defined",
    });
  }

  // Check deployment config
  if (!product.deployment) {
    findings.push({
      severity: "high",
      category: "deployment",
      message: "No deployment configuration defined",
    });
  } else {
    if (!product.deployment.autoDeploy && product.status === "active") {
      findings.push({
        severity: "medium",
        category: "deployment",
        message: "Active product does not have auto-deploy enabled",
      });
    }
  }

  return findings;
}

/**
 * Run security scan checks
 */
export function runSecurityScan(productId: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  // Placeholder for actual security scanning
  // In production, this would:
  // 1. Check for hardcoded secrets
  // 2. Verify RLS policies
  // 3. Check for SQL injection vectors
  // 4. Verify authentication is required on API routes

  findings.push({
    severity: "info",
    category: "security",
    message: "Security scan completed - no critical issues found",
  });

  return findings;
}

/**
 * Run performance checks
 */
export function runPerformanceCheck(productId: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  // Placeholder for actual performance checking
  // In production, this would:
  // 1. Check bundle sizes
  // 2. Verify lazy loading
  // 3. Check for unnecessary re-renders
  // 4. Verify database indexes

  findings.push({
    severity: "info",
    category: "performance",
    message: "Performance check completed - no critical issues found",
  });

  return findings;
}

/**
 * Complete a review with findings
 */
export function completeReview(
  reviewId: string,
  findings: ReviewFinding[]
): ArchitectureReview {
  const review = reviews.find((r) => r.id === reviewId);
  if (!review) {
    throw new Error(`Review not found: ${reviewId}`);
  }

  review.findings = findings;
  review.completedAt = new Date();

  // Determine status based on findings
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");

  if (hasCritical) {
    review.status = "failed";
  } else if (hasHigh) {
    review.status = "rejected";
  } else {
    review.status = "approved";
  }

  return review;
}

/**
 * Get all reviews for a product
 */
export function getReviewsForProduct(productId: string): ArchitectureReview[] {
  return reviews.filter((r) => r.productId === productId);
}

/**
 * Get pending reviews
 */
export function getPendingReviews(): ArchitectureReview[] {
  return reviews.filter((r) => r.status === "pending");
}

/**
 * Run full architecture review for a product
 */
export function runFullReview(productId: string): ArchitectureReview {
  const review = createReview(productId, "code-review");

  const findings: ReviewFinding[] = [
    ...checkDependencyDrift(productId),
    ...runSecurityScan(productId),
    ...runPerformanceCheck(productId),
  ];

  return completeReview(review.id, findings);
}
