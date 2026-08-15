import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTenantFromRequest } from "@/lib/tenant";
import {
  requestBranchContext,
  applyBranchFilter,
  branchIdForWrite,
} from "@/lib/branch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const tenantId = await getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "";
    const category = searchParams.get("category") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const branchCtx = await requestBranchContext(request, tenantId);

    let query = supabase
      .from("cf_finance_transactions")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);

    if (type) {
      query = query.eq("type", type);
    }

    if (category) {
      query = query.eq("category", category);
    }

    query = applyBranchFilter(query, branchCtx);

    const { data: transactions, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let fundsQuery = supabase
      .from("cf_finance_funds")
      .select("*")
      .eq("tenant_id", tenantId);
    fundsQuery = applyBranchFilter(fundsQuery, branchCtx);
    const { data: funds } = await fundsQuery;

    const { data: summary } = await supabase
      .rpc("get_finance_summary", { p_tenant_id: tenantId });

    return NextResponse.json({
      transactions: (transactions || []).map((t) => ({ ...t, amount: Number(t.amount_pesewas || 0) / 100 })),
      funds,
      summary: summary || { total_income: 0, total_expenses: 0, net_balance: 0 },
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Finance GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = await getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, category, amount, description, fund_id, payment_method, member_name } = body;

    if (!type || !amount || !category) {
      return NextResponse.json(
        { error: "Type, amount, and category are required" },
        { status: 400 }
      );
    }

    const branchCtx = await requestBranchContext(request, tenantId);

    const { data: transaction, error } = await supabase
      .from("cf_finance_transactions")
      .insert({
        tenant_id: tenantId,
        branch_id: branchIdForWrite(branchCtx, body.branch_id),
        type,
        category,
        amount_pesewas: Math.round(parseFloat(amount) * 100),
        description,
        fund_id,
        payment_method,
        member_name,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Finance POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const tenantId = await getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const { data: transaction, error } = await supabase
      .from("cf_finance_transactions")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Finance PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const tenantId = await getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("cf_finance_transactions")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Finance DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
