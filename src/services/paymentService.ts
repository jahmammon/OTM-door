import { db, recordAudit, getSettings } from '../db';
import type { Payment, PaymentMethod } from '../types';
import { recalculateOrderTotals } from './orderService';
import { generateSafeSequence } from './sequenceService';

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date?: string;
  reference?: string;
  note?: string;
}

export async function generateNextReceiptNumber(): Promise<string> {
  return await generateSafeSequence('RECEIPT');
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const order = await db.orders.get(input.orderId);
  if (!order) {
    throw new Error('Commande introuvable');
  }

  if (input.amount <= 0) {
    throw new Error('Le montant du versement doit être supérieur à zéro');
  }

  if (input.amount > order.remainingAmount) {
    throw new Error(
      `Le montant du versement (${input.amount.toLocaleString('fr-DZ')} DA) ne peut pas être supérieur au solde restant de la commande (${order.remainingAmount.toLocaleString('fr-DZ')} DA).`
    );
  }

  const receiptNumber = await generateNextReceiptNumber();
  const now = new Date();
  const dateStr = input.date || now.toISOString().split('T')[0];

  const payment: Payment = {
    id: 'pay_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    receiptNumber,
    orderId: order.id,
    orderNumberSnapshot: order.orderNumber,
    clientId: order.clientId,
    clientNameSnapshot: order.clientNameSnapshot,
    date: dateStr,
    amount: Number(input.amount),
    paymentMethod: input.paymentMethod,
    reference: input.reference,
    note: input.note,
    createdAt: now.toISOString()
  };

  await db.payments.add(payment);

  // Recalculate order totals
  await recalculateOrderTotals(order.id);

  await recordAudit(
    'Paiement enregistré',
    'payments',
    `Paiement de ${input.amount.toLocaleString('fr-DZ')} DA reçu pour commande ${order.orderNumber} (${input.paymentMethod}) - Reçu ${receiptNumber}`,
    payment.id
  );

  return payment;
}

export async function deletePayment(paymentId: string): Promise<void> {
  const payment = await db.payments.get(paymentId);
  if (!payment) return;

  await db.payments.delete(paymentId);
  await recalculateOrderTotals(payment.orderId);

  await recordAudit(
    'Suppression paiement',
    'payments',
    `Reçu ${payment.receiptNumber} de ${payment.amount} DA supprimé`,
    paymentId
  );
}
