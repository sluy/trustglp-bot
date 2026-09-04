fetch('https://agencia-ia-core-order-manager.jkmm2u.easypanel.host/community-users/internal/bot-payload')
  .then(res => res.json())
  .then(data => {
     const users = data.active_users;
     console.log("Total users:", users.length);
     users.slice(-5).forEach(u => {
         console.log(`- ${u.alias} (id: ${u.id}) - BTC: ${u.btcCapitalAllocated}, Keys: ${u.apiKey ? 'YES' : 'NO'}`);
     });
  }).catch(console.error);
