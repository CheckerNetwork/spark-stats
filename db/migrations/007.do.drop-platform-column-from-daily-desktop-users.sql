ALTER TABLE daily_desktop_users DROP CONSTRAINT daily_desktop_users_pkey;
ALTER TABLE daily_desktop_users DROP COLUMN platform;
ALTER TABLE daily_desktop_users ADD PRIMARY KEY (day);
