# CSV export

Profile CSV exports contain the filtered repository list. Zero counts remain `0`;
only missing values become empty cells. Quotes, commas and newlines are escaped
as CSV fields.

Repository text comes from GitHub users. String cells that start with spreadsheet
formula markers, leading whitespace followed by a formula marker, or tab/newline
controls receive an apostrophe prefix so spreadsheet import treats them as text.
Numeric values, including negative numbers and zero, remain numeric text.

Spreadsheet applications differ, and saving and reopening a CSV can remove text
guards. This is protection for initial import, not a guarantee for every
spreadsheet workflow. Use JSON export when exact original string values are
needed. JSON export is unchanged.
