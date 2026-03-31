import React from "react";

const MpesaChamaManagement = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">M-Pesa Chama Management</h1>
      <p className="text-lg mb-8 text-muted-foreground">
        Streamline your group's finances with seamless M-Pesa integration.
      </p>
      
      <div className="bg-card p-8 rounded-xl border">
        <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
        <ul className="list-disc pl-6 space-y-4">
          <li>Direct M-Pesa contribution tracking</li>
          <li>Real-time payment notifications for all members</li>
          <li>Automated reconciliation of group statements</li>
          <li>Instant withdrawals to mobile money wallets</li>
        </ul>
      </div>
    </div>
  );
};

export default MpesaChamaManagement;
