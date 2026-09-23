using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Autograt.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", nullable: false, collation: "NOCASE"),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    IsAdmin = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "JournalEntry",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    EntryDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    DayRating = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalEntry", x => x.Id);
                    table.CheckConstraint("CK_JournalEntry_DayRating", "\"DayRating\" BETWEEN 0 AND 10");
                    table.ForeignKey(
                        name: "FK_JournalEntry_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JournalSubEntry",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    JournalEntryId = table.Column<int>(type: "INTEGER", nullable: false),
                    Category = table.Column<int>(type: "INTEGER", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalSubEntry", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JournalSubEntry_JournalEntry_JournalEntryId",
                        column: x => x.JournalEntryId,
                        principalTable: "JournalEntry",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JournalAppend",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    JournalSubEntryId = table.Column<int>(type: "INTEGER", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalAppend", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JournalAppend_JournalSubEntry_JournalSubEntryId",
                        column: x => x.JournalSubEntryId,
                        principalTable: "JournalSubEntry",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_JournalAppend_JournalSubEntryId",
                table: "JournalAppend",
                column: "JournalSubEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntry_UserId_EntryDate",
                table: "JournalEntry",
                columns: new[] { "UserId", "EntryDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_JournalSubEntry_JournalEntryId",
                table: "JournalSubEntry",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_User_Username",
                table: "User",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "JournalAppend");

            migrationBuilder.DropTable(
                name: "JournalSubEntry");

            migrationBuilder.DropTable(
                name: "JournalEntry");

            migrationBuilder.DropTable(
                name: "User");
        }
    }
}
