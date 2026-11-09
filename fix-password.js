const { createClient } = require('@supabase/supabase-js');

// Usar as chaves do .env.local
const supabaseUrl = 'https://ardpabjoepzhkpmkgwgu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3OTMyOTMzNzcsImV4cCI6MjEwODY1MzM3NywicmVmIjoic2VydmljZV9yb2xlIn0.gPEti9FmSQS0_oSdrJK9PihtQENsFAZFqU2nUY4h3G8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Email do usuário
const email = 'brunoalmeida23111996@gmail.com';
const newPassword = 'B23b23v1814*';

async function resetPassword() {
  console.log('Resetting password for:', email);

  try {
    // Primeiro, encontrar o usuário
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.log('Error listing users:', listError.message);
      return;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Found user:', user.id, 'email confirmed:', user.email_confirmed_at);

    // Atualizar a senha do usuário
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUser(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.log('Error updating user:', updateError.message);
      return;
    }

    console.log('Password updated successfully!');
    console.log('Updated user:', JSON.stringify(updatedUser.user, null, 2));

  } catch (e) {
    console.log('Exception:', e.message);
  }
}

resetPassword();