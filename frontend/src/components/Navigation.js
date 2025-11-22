import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Menu,
  X,
  Search,
  User,
  Phone,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useCart } from "../context/CartContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const Navigation = () => {
  const { getTotalItems } = useCart();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/70 border-b shadow-sm">
      {/* Top Header Bar */}
      <div className="bg-blue-600 text-white text-xs md:text-sm py-1 px-4">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <span className="hidden md:block">Free Shipping on Orders Over $75</span>

          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-1" />
              <span>888-PRESM-01</span>
            </div>
            <span className="hidden md:block">Support</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <div className="bg-blue-600 text-white p-2 rounded-xl font-bold text-xl shadow-sm">
              PRESM
            </div>
            <div className="text-gray-800 font-semibold text-lg flex flex-col leading-none">
              <span>PRESM</span>
              <span className="text-blue-600 text-sm">Technologies</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            {/* DTF TRANSFERS */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1 hover:text-blue-600 transition-all ${
                    isActive("/products") ? "text-blue-600 underline underline-offset-4" : ""
                  }`}
                >
                  DTF Transfers <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/products/dtf-transfers">Standard DTF Transfers</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products/gang-sheets">Gang Sheets</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products/custom-designs">Custom Designs</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* HEAT PRESS */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 hover:text-blue-600 transition-all">
                  Heat Press Equipment <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/products/heat-presses">Heat Press Machines</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products/accessories">Accessories</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products/supplies">Supplies</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* OTHER LINKS */}
            <Link
              to="/gang-sheet-builder"
              className={`hover:text-blue-600 transition-all ${
                isActive("/gang-sheet-builder")
                  ? "text-blue-600 underline underline-offset-4"
                  : ""
              }`}
            >
              Gang Sheet Builder
            </Link>

            <Link
              to="/education"
              className={`hover:text-blue-600 transition-all ${
                isActive("/education") ? "text-blue-600 underline underline-offset-4" : ""
              }`}
            >
              Education
            </Link>

            <Link
              to="/about"
              className={`hover:text-blue-600 transition-all ${
                isActive("/about") ? "text-blue-600 underline underline-offset-4" : ""
              }`}
            >
              About
            </Link>
          </div>

          {/* SEARCH (DESKTOP) */}
          <div className="hidden md:flex items-center relative">
            <button
              onClick={() => setSearchActive(!searchActive)}
              className="p-2 hover:bg-gray-200/50 rounded-full transition"
            >
              <Search className="h-5 w-5 text-gray-500" />
            </button>

            {searchActive && (
              <div className="absolute right-0 top-10 bg-white shadow-lg p-3 rounded-xl border w-64 animate-fadeIn">
                <div className="relative">
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE BUTTONS */}
          <div className="flex items-center gap-3">
            {/* ACCOUNT DROPDOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">Account</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link to="/account">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders">Orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* CART */}
            <Link to="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                )}
              </Button>
            </Link>

            {/* MOBILE MENU TOGGLE */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden px-4 pb-4 animate-slideDown bg-white/90 backdrop-blur-lg border-b">
          <div className="space-y-3 text-sm font-medium">
            <Link to="/products" className="block py-2" onClick={() => setMobileOpen(false)}>
              DTF Transfers
            </Link>
            <Link to="/products/heat-presses" className="block py-2" onClick={() => setMobileOpen(false)}>
              Heat Press Equipment
            </Link>
            <Link to="/gang-sheet-builder" className="block py-2" onClick={() => setMobileOpen(false)}>
              Gang Sheet Builder
            </Link>
            <Link to="/education" className="block py-2" onClick={() => setMobileOpen(false)}>
              Education
            </Link>
            <Link to="/about" className="block py-2" onClick={() => setMobileOpen(false)}>
              About
            </Link>
          </div>

          {/* SEARCH in Mobile */}
          <div className="mt-4">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
