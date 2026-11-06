# Test trigger sync_mode_connection_mode
# Test 1: Update connection_mode from non_official to official
# Test 2: Update mode from OFFICIAL to MANUAL
# Test 3: Verify bidirectional sync

Write-Host "=== Testing sync_mode_connection_mode trigger ==="

# Read DB password
$password = Get-Content "C:\Users\Bruno\.claude\Revolution\X\supabase-docker\.env" | Where-Object { $_ -match "POSTGRES_PASSWORD" } | ForEach-Object { $_.Split('=')[1] }

Write-Host "DB Password: $password"

$connStr = "Server=localhost,54321;Database=postgres;User Id=postgres;Password=$password;TrustServerCertificate=True;Connection Timeout=30"
$conn = New-Object System.Data.SqlClient.SqlConnection $connStr

try {
    $conn.Open()
    Write-Host "SUCCESS: Connection opened!"

    # Check initial state
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT id, connection_mode, mode FROM integrations LIMIT 5"
    $reader = $cmd.ExecuteReader()
    Write-Host "=== Initial state (first 5 rows) ==="
    $rowNum = 0
    while ($reader.Read()) {
        $rowNum++
        $id = $reader.GetString($reader.GetOrdinal("id"))
        $cm = $reader.GetString($reader.GetOrdinal("connection_mode"))
        $m = $reader.GetString($reader.GetOrdinal("mode"))
        Write-Host "Row $rowNum: id=$id, connection_mode=$cm, mode=$m"
    }
    $reader.Close()

    if ($rowNum -eq 0) {
        Write-Host "No rows found in integrations table. Need to insert test data or check migration applied."
    } else {
        # Test 1: Update connection_mode
        Write-Host "`n=== Test 1: Update connection_mode to 'official' ==="
        $cmd2 = $conn.CreateCommand()
        $cmd2.CommandText = "UPDATE integrations SET connection_mode = 'official' WHERE connection_mode = 'non_official' LIMIT 1"
        $rowsAffected = $cmd2.ExecuteNonQuery()
        Write-Host "Rows affected: $rowsAffected"

        # Check result
        $cmd3 = $conn.CreateCommand()
        $cmd3.CommandText = "SELECT id, connection_mode, mode FROM integrations WHERE connection_mode = 'official' LIMIT 1"
        $reader2 = $cmd3.ExecuteReader()
        if ($reader2.Read()) {
            $cm2 = $reader2.GetString($reader2.GetOrdinal("connection_mode"))
            $m2 = $reader2.GetString($reader2.GetOrdinal("mode"))
            Write-Host "After UPDATE connection_mode='official': connection_mode=$cm2, mode=$m2"
        }
        $reader2.Close()

        # Test 2: Update mode
        Write-Host "`n=== Test 2: Update mode to 'MANUAL' ==="
        $cmd4 = $conn.CreateCommand()
        $cmd4.CommandText = "UPDATE integrations SET mode = 'MANUAL' WHERE mode = 'OFFICIAL' LIMIT 1"
        $rowsAffected2 = $cmd4.ExecuteNonQuery()
        Write-Host "Rows affected: $rowsAffected2"

        # Check result
        $cmd5 = $conn.CreateCommand()
        $cmd5.CommandText = "SELECT id, connection_mode, mode FROM integrations WHERE mode = 'MANUAL' LIMIT 1"
        $reader3 = $cmd5.ExecuteReader()
        if ($reader3.Read()) {
            $cm3 = $reader3.GetString($reader3.GetOrdinal("connection_mode"))
            $m3 = $reader3.GetString($reader3.GetOrdinal("mode"))
            Write-Host "After UPDATE mode='MANUAL': connection_mode=$cm3, mode=$m3"
        }
        $reader3.Close()

        # Test 3: Update connection_mode back to non_official
        Write-Host "`n=== Test 3: Update connection_mode to 'non_official' ==="
        $cmd6 = $conn.CreateCommand()
        $cmd6.CommandText = "UPDATE integrations SET connection_mode = 'non_official' WHERE connection_mode = 'official' LIMIT 1"
        $rowsAffected3 = $cmd6.ExecuteNonQuery()
        Write-Host "Rows affected: $rowsAffected3"

        # Check result
        $cmd7 = $conn.CreateCommand()
        $cmd7.CommandText = "SELECT id, connection_mode, mode FROM integrations WHERE connection_mode = 'non_official' LIMIT 1"
        $reader4 = $cmd7.ExecuteReader()
        if ($reader4.Read()) {
            $cm4 = $reader4.GetString($reader4.GetOrdinal("connection_mode"))
            $m4 = $reader4.GetString($reader4.GetOrdinal("mode"))
            Write-Host "After UPDATE connection_mode='non_official': connection_mode=$cm4, mode=$m4"
        }
        $reader4.Close()

        # Test 4: Update mode back to OFFICIAL
        Write-Host "`n=== Test 4: Update mode to 'OFFICIAL' ==="
        $cmd8 = $conn.CreateCommand()
        $cmd8.CommandText = "UPDATE integrations SET mode = 'OFFICIAL' WHERE mode = 'MANUAL' LIMIT 1"
        $rowsAffected4 = $cmd8.ExecuteNonQuery()
        Write-Host "Rows affected: $rowsAffected4"

        # Check result
        $cmd9 = $conn.CreateCommand()
        $cmd9.CommandText = "SELECT id, connection_mode, mode FROM integrations WHERE mode = 'OFFICIAL' LIMIT 1"
        $reader5 = $cmd9.ExecuteReader()
        if ($reader5.Read()) {
            $cm5 = $reader5.GetString($reader5.GetOrdinal("connection_mode"))
            $m5 = $reader5.GetString($reader5.GetOrdinal("mode"))
            Write-Host "After UPDATE mode='OFFICIAL': connection_mode=$cm5, mode=$m5"
        }
        $reader5.Close()
    }

    $conn.Close()
    Write-Host "`n=== Test complete ==="

} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}