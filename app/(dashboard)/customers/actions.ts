"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getCustomersPageData(search?: string, status?: string, hasOutstanding?: boolean) {
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get customers with their sales and credits
  const customers = await prisma.customer.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      createdAt: true,
      sales: {
        select: {
          id: true,
          total: true,
          amountPaid: true,
          createdAt: true,
        },
      },
      credits: {
        select: {
          amount: true,
          amountPaid: true,
          dueDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate derived data
  const customersWithData = customers.map((customer) => {
    const totalOrders = customer.sales.length;
    const totalSpent = customer.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const outstanding = customer.credits.reduce(
      (sum, credit) => sum + (Number(credit.amount) - Number(credit.amountPaid)),
      0
    );
    const lastPurchase = customer.sales.length > 0
      ? new Date(Math.max(...customer.sales.map((s) => new Date(s.createdAt).getTime())))
      : null;

    return {
      ...customer,
      sales: customer.sales.map((s) => ({
        ...s,
        total: Number(s.total),
        amountPaid: Number(s.amountPaid),
      })),
      credits: customer.credits.map((c) => ({
        ...c,
        amount: Number(c.amount),
        amountPaid: Number(c.amountPaid),
      })),
      totalOrders,
      totalSpent,
      outstanding,
      lastPurchase,
    };
  });

  // Filter by status if needed
  let filtered = customersWithData;
  if (hasOutstanding) {
    filtered = customersWithData.filter((c) => c.outstanding > 0);
  }

  // Calculate KPIs
  const totalCustomers = customersWithData.length;
  const activeCustomers = customersWithData.length; // All are active for now
  const customersWithCredit = customersWithData.filter((c) => c.outstanding > 0).length;
  const totalReceivables = customersWithData.reduce((sum, c) => sum + c.outstanding, 0);

  return {
    customers: filtered,
    kpi: {
      totalCustomers,
      activeCustomers,
      customersWithCredit,
      totalReceivables,
    },
  };
}

export async function getCustomerDetails(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      createdAt: true,
      sales: {
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          amountPaid: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              productVariant: {
                select: {
                  product: { select: { name: true } },
                },
              },
            },
          },
          payments: {
            select: {
              method: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      credits: {
        select: {
          id: true,
          invoiceRef: true,
          amount: true,
          amountPaid: true,
          dueDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) throw new Error("Customer not found");

  // Get returns
  const returns = await prisma.saleReturn.findMany({
    where: {
      sale: { customerId },
    },
    select: {
      id: true,
      type: true,
      quantity: true,
      reason: true,
      refundAmount: true,
      storeCredit: true,
      createdAt: true,
      sale: {
        select: {
          invoiceNo: true,
          items: {
            select: {
              productVariant: { select: { product: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize Decimal values for client
  const serializedCustomer = {
    ...customer,
    sales: customer.sales.map((s) => ({
      ...s,
      total: Number(s.total),
      amountPaid: Number(s.amountPaid),
    })),
    credits: customer.credits.map((c) => ({
      ...c,
      amount: Number(c.amount),
      amountPaid: Number(c.amountPaid),
    })),
  };

  const serializedReturns = returns.map((r) => ({
    ...r,
    refundAmount: Number(r.refundAmount),
  }));

  // Calculate summary
  const totalOrders = serializedCustomer.sales.length;
  const totalSpent = serializedCustomer.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const totalReturns = serializedReturns.length;
  const outstanding = serializedCustomer.credits.reduce(
    (sum, credit) => sum + (Number(credit.amount) - Number(credit.amountPaid)),
    0
  );

  return {
    customer: serializedCustomer,
    returns: serializedReturns,
    summary: {
      totalOrders,
      totalSpent,
      totalReturns,
      outstanding,
    },
  };
}

export async function createCustomer(
  name: string,
  phone: string,
  email?: string,
  address?: string,
  notes?: string
) {
  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
      email: email || null,
      address: address || null,
      notes: notes || null,
    },
    select: { id: true, name: true },
  });

  return customer;
}

export async function updateCustomer(
  customerId: string,
  name?: string,
  phone?: string,
  email?: string,
  address?: string,
  notes?: string
) {
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(email && { email }),
      ...(address && { address }),
      ...(notes && { notes }),
    },
    select: { id: true, name: true },
  });

  return customer;
}

export async function recordCustomerPayment(
  customerId: string,
  creditId: string,
  amount: number,
  method: string
) {
  const credit = await prisma.customerCredit.findUnique({
    where: { id: creditId },
    select: { amount: true, amountPaid: true },
  });

  if (!credit) throw new Error("Credit record not found");

  const newAmountPaid = Number(credit.amountPaid) + amount;
  const totalAmount = Number(credit.amount);

  if (newAmountPaid > totalAmount) {
    throw new Error("Payment exceeds outstanding amount");
  }

  // Update credit record
  const updated = await prisma.customerCredit.update({
    where: { id: creditId },
    data: { amountPaid: new Decimal(newAmountPaid) },
    select: { id: true, amountPaid: true },
  });

  return updated;
}
