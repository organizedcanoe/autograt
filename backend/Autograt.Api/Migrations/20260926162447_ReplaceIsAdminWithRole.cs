using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Autograt.Api.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceIsAdminWithRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "User",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            // Existing accounts predate approval, so they are already approved: admins stay Admin (2), others become Standard (1).
            migrationBuilder.Sql("UPDATE \"User\" SET \"Role\" = CASE WHEN \"IsAdmin\" THEN 2 ELSE 1 END;");

            migrationBuilder.DropColumn(
                name: "IsAdmin",
                table: "User");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "User",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("UPDATE \"User\" SET \"IsAdmin\" = \"Role\" = 2;");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "User");
        }
    }
}
