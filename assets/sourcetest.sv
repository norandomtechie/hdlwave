module tb_top();
    logic hz100, reset;
    logic [20:0] pb;
    wire [7:0] ss7, ss6, ss5, ss4, ss3, ss2, ss1, ss0, left, right;
    wire red, green, blue;
    wire [7:0] txdata;
    wire txclk;
    wire txready;
    wire [7:0] rxdata;
    wire rxclk;
    wire rxready;

    top ice40 (hz100, reset, pb, ss7, ss6, ss5, ss4, 
               ss3, ss2, ss1, ss0, left, right, red, green, blue, 
               txdata, txclk, txready, rxdata, rxclk, rxready);
endmodule