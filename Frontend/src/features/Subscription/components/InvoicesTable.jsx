import React, { useEffect } from 'react';
import { useSubscription } from '../hooks/useSubscription';

export const InvoicesTable = () => {
  const { invoices, fetchInvoices, getInvoicePdfUrl } = useSubscription();

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  return (
    <div className="invoices-section">
      <h3>Billing History & Tax Invoices</h3>
      <p>Download GST-compliant tax invoices for your subscription payments.</p>

      <div className="invoices-table-card">
        {invoices && invoices.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Plan & Cycle</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id}>
                  <td>
                    <strong>{inv.invoiceNumber}</strong>
                  </td>
                  <td>
                    {inv.items?.[0]?.description || `${inv.planKey?.toUpperCase()} Plan`}
                  </td>
                  <td>
                    <strong>₹{(inv.totalAmount / 100).toFixed(2)}</strong>
                  </td>
                  <td>
                    {new Date(inv.issuedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td>
                    <span className={`badge-${(inv.status || 'paid').toLowerCase()}`}>
                      {(inv.status || 'PAID').toUpperCase()}
                    </span>
                  </td>                  <td style={{ textAlign: 'right' }}>
                    <a
                      href={getInvoicePdfUrl(inv._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="download-link"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      View Invoice
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-invoices">
            No past invoices found. Once you upgrade, your tax invoices will appear here.
          </div>
        )}
      </div>
    </div>
  );
};
