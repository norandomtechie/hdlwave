module tb_top (
        // I/O ports
        input  logic hz100, reset,
        input  logic [20:0] pb,
        output logic [7:0] left, right,
              ss7, ss6, ss5, ss4, ss3, ss2, ss1, ss0,
        output logic red, green, blue,

        // UART ports
        output logic [7:0] txdata,
        input  logic [7:0] rxdata,
        output logic txclk, rxclk,
        input  logic txready, rxready
    );

initial begin
    $dumpfile("trace/top.vcd");
    $dumpvars(0, top);
end

top ice40 (
  .hz100 (hz100),
  .reset (reset),
  .pb (pb),
  .left (left),
  .right (right),
  .ss7 (ss7),
  .ss6 (ss6),
  .ss5 (ss5),
  .ss4 (ss4),
  .ss3 (ss3),
  .ss2 (ss2),
  .ss1 (ss1),
  .ss0 (ss0),
  .red (red),
  .green (green),
  .blue (blue),
  .txdata (txdata),
  .rxdata (rxdata),
  .txclk (txclk),
  .rxclk (rxclk),
  .txready (txready),
  .rxready (rxready)
);

endmodule