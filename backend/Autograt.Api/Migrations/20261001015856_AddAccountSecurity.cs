using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Autograt.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "User",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "User",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            // Each existing user needs their own random stamp. Older tokens have no stamp, so everyone logs in again once.
            migrationBuilder.Sql("UPDATE \"User\" SET \"SecurityStamp\" = lower(hex(randomblob(16)));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "User");

            migrationBuilder.DropColumn(
                name: "SecurityStamp",
                table: "User");
        }
    }
}
